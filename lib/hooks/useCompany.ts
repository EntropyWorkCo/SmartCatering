import { useEffect, useState } from "react";
import { companyService } from "../services/companyService";

export const useCompany = (userId?: string) => {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchCompany = async () => {
      setLoading(true);
      try {
        const data = await companyService.getCompanyProfile(userId);
        setCompany(data);
      } catch (error) {
        console.error("Şirket bilgisi çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [userId]);

  const updateCompany = async (companyData: any) => {
    setLoading(true);
    try {
      const data = await companyService.saveCompany({
        ...companyData,
        user_id: userId,
      });
      setCompany(data);
      return { success: true, data };
    } catch (error: any) {
      console.error(error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { company, loading, updateCompany };
};
