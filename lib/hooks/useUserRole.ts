import { useAuthStore, UserRole } from "../store/authStore";

export { UserRole };

export function useUserRole() {
  const { role, firmaId, loading, isAdmin } = useAuthStore();

  return { 
    role, 
    firmaId, 
    loading,
    isAdmin,
    isFirmaSahibi: role === 'firma_sahibi',
    isCalisan: role === 'firma_calisan',
    isBireysel: role === 'bireysel'
  };
}
