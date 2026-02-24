// lib/services/companyService.ts
import { supabase } from "../supabase";

export const companyService = {
  // Kullanıcıya ait şirket bilgisini getir
  async getCompanyProfile(userId: string) {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }
    return data;
  },

  // Şirket bilgilerini kaydet veya güncelle (Soru işaretleri kaldırıldı)
  async saveCompany(companyData: {
    user_id: string;
    company_name: string;
    tax_number: string; // Zorunlu yapıldı
    address: string; // Zorunlu yapıldı
    company_phone: string; // Zorunlu yapıldı
  }) {
    const { data, error } = await supabase
      .from("companies")
      .upsert(companyData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
