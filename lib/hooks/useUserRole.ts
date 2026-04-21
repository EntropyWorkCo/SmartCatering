import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { userService } from "../services/userService";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = 'admin' | 'firma_sahibi' | 'firma_calisan' | 'bireysel';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [firmaId, setFirmaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setRole(null);
          setFirmaId(null);
          setLoading(false);
          return;
        }

        // 1. ADIM: KESİN ADMİN KONTROLÜ (En öncelikli)
        const isAdminStorage = await AsyncStorage.getItem("isAdmin");
        let resolvedRole: string | undefined | null = null;
        let resolvedFirmaId: string | undefined | null = null;

        if (isAdminStorage === "true") {
          resolvedRole = 'admin';
        } else {
          // RPC check as fallback
          const isAdmin = await userService.checkIsAdmin();
          if (isAdmin) {
            resolvedRole = 'admin';
            await AsyncStorage.setItem("isAdmin", "true");
          }
        }

        // Eğer admin değilse diğerlerine bak
        if (resolvedRole !== 'admin') {
            // app_metadata
            resolvedRole = session.user.app_metadata?.role;
            resolvedFirmaId = session.user.app_metadata?.firma_id;

            // user_metadata
            if (!resolvedRole) resolvedRole = session.user.user_metadata?.role;
            if (!resolvedFirmaId) resolvedFirmaId = session.user.user_metadata?.firma_id;

            // public.users fallback
            if (!resolvedRole) {
              const { data: profile } = await supabase
                .from("users")
                .select("role, company_id, is_company")
                .eq("id", session.user.id)
                .single();
              
              if (profile) {
                  if (profile.role === 'admin') resolvedRole = 'admin';
                  else if (profile.role === 'owner' || profile.role === 'corporate' || profile.is_company) resolvedRole = 'firma_sahibi';
                  else if (profile.company_id) resolvedRole = 'firma_calisan';
                  else resolvedRole = 'bireysel';
                 
                 resolvedFirmaId = profile.company_id;
              }
            }
        }

        setRole(resolvedRole as UserRole);
        setFirmaId(resolvedFirmaId || null);
      } catch (error) {
        console.error("Error resolving user role:", error);
      } finally {
        setLoading(false);
      }
    }

    resolveRole();
    
    // Auth değişimi dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔐 Auth state change detected:", event);
      setLoading(true); // Önemli: Yeni durumda yetkiyi tekrar hesaplamadan önce bekleme moduna geç
      await resolveRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { 
    role, 
    firmaId, 
    loading,
    isAdmin: role === 'admin',
    isFirmaSahibi: role === 'firma_sahibi',
    isCalisan: role === 'firma_calisan',
    isBireysel: role === 'bireysel'
  };
}
