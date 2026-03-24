import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

let authListeners: Array<() => void> = [];

export const triggerAuthRefresh = async () => {
  await Promise.all(authListeners.map(async (fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
  }));
};

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Session'ı al
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            // Refresh token hatası durumunda temizlik yap
            console.warn("Otomatik oturum tazelenemedi:", sessionError.message);
            await supabase.auth.signOut();
            setSession(null);
        } else if (session) {
            setSession(session);
        } else {
            const softUserStr = await AsyncStorage.getItem("softUser");
            if (softUserStr) {
                try {
                const softUser = JSON.parse(softUserStr);
                setSession({ user: softUser, isSoftUser: true });
                } catch (e) {
                console.error("SoftUser parse error:", e);
                }
            }
        }
      } catch (error) {
        console.error("Session init error:", error);
        await supabase.auth.signOut();
        setSession(null);
      }

      // 2. Admin rolünü storage'dan oku
      const adminFlag = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminFlag === "true");

      setLoading(false);
    };

    initAuth();
    authListeners.push(initAuth);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
         setSession(session);
      } else {
         const softUserStr = await AsyncStorage.getItem("softUser");
         if (softUserStr) {
            try {
               const softUser = JSON.parse(softUserStr);
               setSession({ user: softUser, isSoftUser: true });
            } catch (e) {
               setSession(null);
            }
         } else {
            setSession(null);
         }
      }
      const adminFlag = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminFlag === "true");
    });

    return () => {
      subscription.unsubscribe();
      authListeners = authListeners.filter(f => f !== initAuth);
    };
  }, []);

  return { session, user: session?.user, loading, isAdmin };
};
