import { useEffect, useState } from "react";
import { supabase } from "../supabase";

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

        // 1. Öncelik: app_metadata (En güvenli ve hızlı)
        let resolvedRole = session.user.app_metadata?.role;
        let resolvedFirmaId = session.user.app_metadata?.firma_id;

        // 2. Öncelik: user_metadata
        if (!resolvedRole) resolvedRole = session.user.user_metadata?.role;
        if (!resolvedFirmaId) resolvedFirmaId = session.user.user_metadata?.firma_id;

        // 3. Öncelik (GEÇİŞ SÜRECİ FALLBACK): public.users tablosuna bak
        if (!resolvedRole) {
          const { data: profile } = await supabase
            .from("users")
            .select("role, company_id, is_company")
            .eq("id", session.user.id)
            .single();
          
          if (profile) {
             if (profile.role === 'admin') resolvedRole = 'admin';
             else if (profile.role === 'corporate' || profile.is_company) resolvedRole = 'firma_sahibi';
             else if (profile.company_id) resolvedRole = 'firma_calisan';
             else resolvedRole = 'bireysel';
             
             resolvedFirmaId = profile.company_id;
          }
        }

        setRole(resolvedRole as UserRole);
        setFirmaId(resolvedFirmaId);
      } catch (error) {
        console.error("Error resolving user role:", error);
      } finally {
        setLoading(false);
      }
    }

    resolveRole();
    
    // Auth değişimi dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      resolveRole();
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
