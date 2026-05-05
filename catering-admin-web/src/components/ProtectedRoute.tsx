import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { userService } from "../lib/services/userService";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        // Session varsa, is_admin yetkisini kontrol et
        const hasAdminRole = await userService.checkIsAdmin();
        
        if (mounted) {
          setIsAdmin(hasAdminRole === true);
          setLoading(false);
          
          if (!hasAdminRole) {
             // Yetkisiz kullanıcıysa çıkış yaptır
             await supabase.auth.signOut();
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mounted) {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return isAdmin ? <Outlet /> : <Navigate to="/login" replace />;
}
