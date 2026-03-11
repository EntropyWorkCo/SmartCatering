import { useEffect, useState } from "react";
import { supabase } from "../supabase";

import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Session'ı al
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // 2. Admin rolünü storage'dan oku
      const adminFlag = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminFlag === "true");

      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      // Oturum değiştiğinde (ör. çıkış yapıldığında) admin flag'ini de güncelle
      const adminFlag = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminFlag === "true");
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user, loading, isAdmin };
};
