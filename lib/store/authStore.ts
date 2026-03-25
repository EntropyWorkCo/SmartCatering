import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "../supabase";

interface AuthState {
  session: any | null;
  user: any | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  initialize: (force?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  initialized: false,

  setSession: (session) => {
    set({ 
      session, 
      user: session?.user || null,
      loading: false 
    });
  },

  setLoading: (loading) => set({ loading }),
  
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  initialize: async (force = false) => {
    if (get().initialized && !force) return;

    try {
      // 1. Get Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let finalSession = session;

      if (sessionError) {
        console.warn("Auth initialization session error:", sessionError.message);
        await supabase.auth.signOut();
        finalSession = null;
      } else if (!session) {
        // Check for soft user if no supabase session
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

      // 2. Get Admin Status
      const adminFlag = await AsyncStorage.getItem("isAdmin");
      
      set({ 
        session: finalSession, 
        user: finalSession?.user || null,
        isAdmin: adminFlag === "true",
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

        const adminFlag = await AsyncStorage.getItem("isAdmin");
        
        set({ 
          session: currentSession, 
          user: currentSession?.user || null,
          isAdmin: adminFlag === "true",
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
    set({ session: null, user: null, isAdmin: false, loading: false });
  }
}));
