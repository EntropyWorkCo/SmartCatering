import { useEffect, useState } from "react";
import { companyService } from "../services/companyService";

export const useCompany = (userId?: string) => {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // userId yoksa hiçbir şey yapma
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
    // 1. KRİTİK KONTROL: userId yoksa veya boşsa kaydı asla başlatma
    if (!userId) {
      return { success: false, error: "Kullanıcı oturumu bulunamadı!" };
    }

    // 2. BOŞ VERİ KONTROLÜ: İsim veya Adres girilmemişse durdur
    const name = companyData?.name?.toString().trim();
    const address = companyData?.address?.toString().trim();

    if (!name || !address) {
      return { success: false, error: "Firma adı ve adres boş bırakılamaz!" };
    }

    setLoading(true);
    try {
      // TypeScript hatasını önlemek için userId'nin varlığını garanti ettik
      const data = await companyService.saveCompany({
        ...companyData,
        name,
        address,
        user_id: userId, // Artık burada hata vermeyecek
      });
      setCompany(data);
      return { success: true, data };
    } catch (error: any) {
      console.error("Şirket kaydedilirken hata:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { company, loading, updateCompany };
};
