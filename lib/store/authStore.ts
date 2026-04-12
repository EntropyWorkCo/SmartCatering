import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "../supabase";

interface AuthState {
  session: any | null;
  user: any | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setRole: (role: string | null) => void;
  initialize: (force?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: null,
  isAdmin: false,
  loading: true,
  initialized: false,

  setSession: (session) => {
    const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null;
    set({ 
      session, 
      user: session?.user || null,
      role,
      isAdmin: role === 'admin',
      loading: false 
    });
  },

  setLoading: (loading) => set({ loading }),
  
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  setRole: (role) => set({ role, isAdmin: role === 'admin' }),

  initialize: async (force = false) => {
    if (get().initialized && !force) return;

    try {
      // 1. Get Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let finalSession = session;

      if (sessionError) {
        console.warn("Auth initialization session error:", sessionError.message);
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

      // 2. Resolve Role and Admin Status
      const role = finalSession?.user?.app_metadata?.role || finalSession?.user?.user_metadata?.role || null;
      let isAdmin = role === 'admin';
      
      if (!role && finalSession?.user && !(finalSession as any).isSoftUser) {
        const { data: adminData } = await supabase.rpc("is_admin");
        isAdmin = !!adminData;
        await AsyncStorage.setItem("isAdmin", isAdmin ? "true" : "false");
      } else if (!role) {
        const adminFlag = await AsyncStorage.getItem("isAdmin");
        isAdmin = adminFlag === "true";
      }
      
      set({ 
        session: finalSession, 
        user: finalSession?.user || null,
        role,
        isAdmin: isAdmin,
        loading: false,
        initialized: true
      });

      // 3. Listen for changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
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

        const currentRole = currentSession?.user?.app_metadata?.role || currentSession?.user?.user_metadata?.role || null;
        let isNowAdmin = currentRole === 'admin';
        
        if (!currentRole && currentSession?.user && !(currentSession as any).isSoftUser) {
          const { data: adminData } = await supabase.rpc("is_admin");
          isNowAdmin = !!adminData;
          await AsyncStorage.setItem("isAdmin", isNowAdmin ? "true" : "false");
        } else if (!currentRole) {
          const adminFlag = await AsyncStorage.getItem("isAdmin");
          isNowAdmin = adminFlag === "true";
        }
        
        set({ 
          session: currentSession, 
          user: currentSession?.user || null,
          role: currentRole,
          isAdmin: isNowAdmin,
          loading: false
        });
      });
    } catch (error) {
      console.error("Auth store initialization failed:", error);
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem("isAdmin");
    await AsyncStorage.removeItem("softUser");
    set({ session: null, user: null, role: null, isAdmin: false, loading: false });
  }
}));
