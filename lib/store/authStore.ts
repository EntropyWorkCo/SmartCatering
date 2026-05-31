import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "../supabase";

export type UserRole = 'admin' | 'firma_sahibi' | 'firma_calisan' | 'bireysel' | null;

interface AuthState {
  session: any | null;
  user: any | null;
  role: UserRole;
  firmaId: string | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
  subscription: any | null;
  
  initialize: (force?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: null,
  firmaId: null,
  isAdmin: false,
  loading: true,
  initialized: false,
  subscription: null,

  setRole: (role: UserRole) => set({ role, loading: false }),

  initialize: async (force = false) => {
    if (get().initialized && !force) return;

    // 1. ÖNCE DİNLEYİCİYİ BAŞLAT (Herhangi bir mesajı kaçırmamak için)
    if (!get().subscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        console.log("🔄 Auth State:", _event);
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
          let { role, firmaId } = await resolveRoleData(session);
          // Son guard: resolveRoleData geç bitip admin rolünü ezmesini engelle.
          // Stale INITIAL_SESSION veya normal login race condition'ı burada yakalanır.
          try {
            const cachedIsAdmin = await AsyncStorage.getItem("isAdmin");
            if (cachedIsAdmin === "true") role = 'admin';
          } catch (_) {}
          set({
            session,
            user: session?.user || null,
            role,
            firmaId,
            isAdmin: role === 'admin',
            loading: false
          });
        } else if (_event === 'SIGNED_OUT') {
          set({ session: null, user: null, role: null, firmaId: null, isAdmin: false, loading: false });
        }
      });
      set({ subscription });
    }

    // 2. SONRA OTURUMU KONTROL ET
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let finalSession = session;

      // KRİTİK HATA KONTROLÜ
      if (sessionError && (sessionError.message.includes("Refresh Token") || sessionError.status === 400)) {
        console.warn("🔄 Bozuk oturum tespit edildi, temizleniyor...");
        await get().signOut();
        return;
      }

      if (sessionError || !session) {
        const softUserStr = await AsyncStorage.getItem("softUser");
        if (softUserStr) {
          try {
            const softUser = JSON.parse(softUserStr);
            finalSession = { user: softUser, isSoftUser: true } as any;
          } catch (e) {}
        }
      }

      let { role, firmaId } = await resolveRoleData(finalSession);
      // Son guard: initialize da stale sonuç yazabilir, tekrar kontrol et.
      try {
        const cachedIsAdmin = await AsyncStorage.getItem("isAdmin");
        if (cachedIsAdmin === "true") role = 'admin';
      } catch (_) {}

      set({
        session: finalSession,
        user: finalSession?.user || null,
        role,
        firmaId,
        isAdmin: role === 'admin',
        loading: false,
        initialized: true
      });
    } catch (error) {
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    // 1. ÖNCE state'i ve cache'i temizle (Yarış koşulunu engellemek için)
    set({ session: null, user: null, role: null, firmaId: null, isAdmin: false, loading: false });
    await AsyncStorage.multiRemove(["isAdmin", "softUser", "userRole", "firmaId"]);
    
    try {
      // 2. SONRA Supabase oturumunu kapat
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    }
  }
}));

/**
 * Rol hesaplama mantığını merkezi bir yardımcı fonksiyona taşıyoruz.
 */
async function resolveRoleData(session: any): Promise<{ role: UserRole, firmaId: string | null }> {
    if (!session?.user) return { role: 'bireysel', firmaId: null };

    // Admin login, setSession'dan önce bu değerleri yazar. onAuthStateChange'in üstüne yazmasını engelle.
    try {
        const cachedIsAdmin = await AsyncStorage.getItem("isAdmin");
        const cachedRole = await AsyncStorage.getItem("userRole");
        if (cachedIsAdmin === "true" && cachedRole === "admin") {
            return { role: 'admin', firmaId: null };
        }
    } catch (_) {}

    const timeoutPromise = new Promise<{ role: UserRole, firmaId: string | null }>((resolve) => {
        setTimeout(() => {
            console.warn("⚠️ Rol çözümleme zaman aşımı.");
            resolve({ role: null, firmaId: null }); 
        }, 10000); 
    });

    const logicPromise = (async (): Promise<{ role: UserRole, firmaId: string | null }> => {
        const userId = session.user.id;
        const isSoftUser = !!session.isSoftUser;

        // 1. ADIM: Metadata Kontrolü (HIZLI YOL)
        const metadata = session.user.app_metadata || session.user.user_metadata || {};
        const roleFromMetadata = metadata.role;
        const firmaIdFromMetadata = metadata.firma_id;

        const mapRole = (r: string): UserRole => {
            if (r === "admin") return "admin";
            if (r === "owner" || r === "corporate" || r === "firma_sahibi") return "firma_sahibi";
            if (r === "employee" || r === "staff" || r === "firma_calisan") return "firma_calisan";
            return "bireysel";
        };

        if (roleFromMetadata) {
            return { 
                role: mapRole(roleFromMetadata), 
                firmaId: firmaIdFromMetadata || null 
            };
        }

        // 2. ADIM: Veritabanı (Public.Users) Kontrolü (Cache Kullanmıyoruz)
        if (!isSoftUser) {
            try {
                // Admin RPC kontrolü
                const { data: isAdminRPC } = await supabase.rpc("is_admin");
                if (isAdminRPC) {
                    return { role: 'admin', firmaId: null };
                }

                // Normal profil kontrolü
                const { data: profile } = await supabase
                    .from("users")
                    .select("role, company_id, is_company")
                    .eq("id", userId)
                    .maybeSingle();

                if (profile) {
                    return { 
                        role: mapRole(profile.role || (profile.is_company ? 'corporate' : 'bireysel')), 
                        firmaId: profile.company_id || null 
                    };
                }
            } catch (e) {
                console.warn("Database role check failed:", e);
            }
        }

        return { role: 'bireysel', firmaId: null };
    })();

    return Promise.race([logicPromise, timeoutPromise]);
}
