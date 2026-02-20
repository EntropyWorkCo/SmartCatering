import { useState } from "react";
import { adminLogin } from "../services/adminService";

export const useAdmin = () => {
  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const login = async (email: string, accessCode: string) => {
    setLoading(true);
    try {
      const data = await adminLogin(email, accessCode);
      setAdmin(data);
      return true;
    } catch (error) {
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { admin, login, loading };
};
