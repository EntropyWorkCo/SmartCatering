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

    try {
      // 1. Get Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let finalSession = session;

      if (sessionError) {
        if (sessionError.message.includes("Refresh Token") || sessionError.status === 400) {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem("isAdmin");
          await AsyncStorage.removeItem("softUser");
        }
        finalSession = null;
      } else if (!session) {
        const softUserStr = await AsyncStorage.getItem("softUser");
        if (softUserStr) {
          try {
            const softUser = JSON.parse(softUserStr);
            finalSession = { user: softUser, isSoftUser: true } as any;
          } catch (e) {
            console.error("SoftUser parse error:", e);
          }
        }
      }

      // 2. Resolve Full Role
      const result = await resolveRoleData(finalSession);
      
      set({ 
        session: finalSession, 
        user: finalSession?.user || null,
        role: result.role,
        firmaId: result.firmaId,
        isAdmin: result.role === 'admin',
        loading: false,
        initialized: true
      });

      // 3. Listen for changes (Only if not already listening)
      if (!get().subscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          console.log("🔄 Auth Store Change:", _event);
          
          let currentSession = session;
          if (!session) {
            const softUserStr = await AsyncStorage.getItem("softUser");
            if (softUserStr) {
                try {
                    const softUser = JSON.parse(softUserStr);
                    currentSession = { user: softUser, isSoftUser: true } as any;
                } catch (e) {}
            }
          }

          const freshResult = await resolveRoleData(currentSession);
          
          set({ 
            session: currentSession, 
            user: currentSession?.user || null,
            role: freshResult.role,
            firmaId: freshResult.firmaId,
            isAdmin: freshResult.role === 'admin',
            loading: false
          });
        });
        set({ subscription });
      }
    } catch (error) {
      console.error("Auth store initialization failed:", error);
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    }
    await AsyncStorage.multiRemove(["isAdmin", "softUser", "userRole"]);
    set({ session: null, user: null, role: null, firmaId: null, isAdmin: false, loading: false });
  }
}));

/**
 * Rol hesaplama mantığını merkezi bir yardımcı fonksiyona taşıyoruz.
 */
async function resolveRoleData(session: any): Promise<{ role: UserRole, firmaId: string | null }> {
    if (!session?.user) {
        return { role: null, firmaId: null };
    }

    const userId = session.user.id;
    const isSoftUser = !!session.isSoftUser;

    // 1. ADIM: Admin Kontrolü
    const isAdminStorage = await AsyncStorage.getItem("isAdmin");
    if (isAdminStorage === "true") {
        return { role: 'admin', firmaId: null };
    }

    // RPC check for admin
    if (!isSoftUser) {
        const { data: isAdminRPC } = await supabase.rpc("is_admin");
        if (isAdminRPC) {
            await AsyncStorage.setItem("isAdmin", "true");
            return { role: 'admin', firmaId: null };
        }
    }

    // 2. ADIM: Cache'lenmiş Rol Kontrolü (Hız için)
    const cachedRole = await AsyncStorage.getItem("userRole");
    if (cachedRole) {
        return { role: cachedRole as any, firmaId: null }; // Firma ID gerekiyorsa aşağıda detaylı çözülecek ama yönlendirme için bu yeterli
    }

    // 3. ADIM: Metadata Kontrolü
    let role = session.user.app_metadata?.role || session.user.user_metadata?.role;
    let firmaId = session.user.app_metadata?.firma_id || session.user.user_metadata?.firma_id;

    if (role && role === 'admin') return { role: 'admin', firmaId: null };

    // 3. ADIM: Veritabanı (Public.Users) Kontrolü
    if (!role && !isSoftUser) {
        const { data: profile } = await supabase
            .from("users")
            .select("role, company_id, is_company")
            .eq("id", userId)
            .maybeSingle();

        if (profile) {
            if (profile.role === 'admin') role = 'admin';
            else if (profile.role === 'owner' || profile.role === 'corporate' || profile.is_company) role = 'firma_sahibi';
            else if (profile.company_id) role = 'firma_calisan';
            else role = 'bireysel';
            
            firmaId = profile.company_id;
        }
    }

    // Fallback
    if (!role) role = 'bireysel';

    return { 
        role: role as UserRole, 
        firmaId: firmaId || null 
    };
}
