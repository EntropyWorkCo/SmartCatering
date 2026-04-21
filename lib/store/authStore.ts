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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let finalSession = session;
      if (sessionError || !session) {
        const softUserStr = await AsyncStorage.getItem("softUser");
        if (softUserStr) {
          try {
            const softUser = JSON.parse(softUserStr);
            finalSession = { user: softUser, isSoftUser: true } as any;
          } catch (e) {}
        }
      }

      // Sadece ana verileri set et, rolü ihtiyaca göre useUserRole veya ekranlar çözsün
      set({ 
        session: finalSession, 
        user: finalSession?.user || null,
        loading: false,
        initialized: true
      });

      if (!get().subscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          console.log("🔄 Auth State:", _event);
          if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
            set({ session, user: session?.user || null, loading: false });
          } else if (_event === 'SIGNED_OUT') {
            set({ session: null, user: null, role: null, loading: false });
          }
        });
        set({ subscription });
      }
    } catch (error) {
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

    // 1. ADIM: Admin Kontrolü (Önce Cache, sonra Raporlama)
    const isAdminStorage = await AsyncStorage.getItem("isAdmin");
    if (isAdminStorage === "true") {
        return { role: 'admin', firmaId: null };
    }

    // RPC check for admin - Sadece gerçek kullanıcılar için ve hata yakalamalı
    if (!isSoftUser) {
        try {
            const { data: isAdminRPC } = await supabase.rpc("is_admin");
            if (isAdminRPC) {
                await AsyncStorage.setItem("isAdmin", "true");
                return { role: 'admin', firmaId: null };
            }
        } catch (e) {
            console.warn("Admin RPC check bypassed or failed");
        }
    }

    // 2. ADIM: Metadata Kontrolü (Hızlı Yol)
    let roleFromMetadata = session.user.app_metadata?.role || session.user.user_metadata?.role;
    let firmaIdFromMetadata = session.user.app_metadata?.firma_id || session.user.user_metadata?.firma_id;

    // Database'deki 'owner' veya 'corporate' rollerini bizim sistemdeki 'firma_sahibi'ne map ediyoruz
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

    // 3. ADIM: Cache'lenmiş Rol Kontrolü
    const cachedRole = await AsyncStorage.getItem("userRole");
    if (cachedRole) {
        return { role: mapRole(cachedRole), firmaId: null };
    }

    // 4. ADIM: Veritabanı (Public.Users) Kontrolü (En son çare)
    if (!isSoftUser) {
        const { data: profile } = await supabase
            .from("users")
            .select("role, company_id, is_company")
            .eq("id", userId)
            .maybeSingle();

        if (profile) {
            let role: UserRole = "bireysel";
            if (profile.role === 'admin') role = 'admin';
            else if (profile.role === 'owner' || profile.role === 'corporate' || profile.is_company) role = 'firma_sahibi';
            else if (profile.company_id) role = 'firma_calisan';
            
            return { 
                role, 
                firmaId: profile.company_id || null 
            };
        }
    }

    return { role: 'bireysel', firmaId: null };
}
