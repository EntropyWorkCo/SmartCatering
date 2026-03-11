import { useEffect, useState } from "react";
import { userService } from "../services/userService";

export const useProfile = (userId?: string) => {
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profileData, adminStatus] = await Promise.all([
        userService.getProfile(userId),
        userService.checkIsAdmin(),
      ]);
      setProfile(profileData);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  return { profile, isAdmin, loading, refresh: fetchProfile };
};
