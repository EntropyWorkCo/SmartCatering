import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

export const triggerAuthRefresh = async () => {
  const store = useAuthStore.getState();
  await store.initialize(true);
};

export const useAuth = () => {
  const { session, user, loading, isAdmin, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { session, user, loading, isAdmin };
};
