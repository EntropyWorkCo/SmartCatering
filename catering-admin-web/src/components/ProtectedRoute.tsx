import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    function checkAuth() {
      try {
        const adminSession = localStorage.getItem("admin_session");
        
        if (!adminSession) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Session varsa admin olarak kabul et (zaten Login aşamasında tablo kontrol edildi)
        setIsAdmin(true);
        setLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAdmin(false);
        setLoading(false);
      }
    }

    checkAuth();
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
