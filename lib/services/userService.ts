import { supabase } from "../supabase";

export const userService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;

    // Şirket bilgilerini çek ve profile ekle
    const { data: companyData } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (companyData) {
      (data as any).corporate_info = {
        companyName: companyData.company_name,
        taxNumber: companyData.tax_number,
        companyPhone: companyData.company_phone,
        invoiceAddress: companyData.address
      };
    }

    return data;
  },

  async updateCorporateInfo(userId: string, data: { companyName: string, taxNumber: string, companyPhone: string, invoiceAddress: string }) {
    // Önce kullanıcının şirketi var mı kontrol et
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existingCompany) {
      const { error } = await supabase
        .from("companies")
        .update({
          company_name: data.companyName,
          tax_number: data.taxNumber,
          company_phone: data.companyPhone,
          address: data.invoiceAddress
        })
        .eq("user_id", userId);

      if (error) throw error;
    } else {
      // Şirket kaydı yoksa yeni bir tane oluştur
      const { error } = await supabase
        .from("companies")
        .insert({
          user_id: userId,
          company_name: data.companyName,
          tax_number: data.taxNumber,
          company_phone: data.companyPhone,
          address: data.invoiceAddress,
        });

      if (error) throw error;
    }
  },
  async updateProfile(userId: string, data: { fullName: string, phone: string }) {
    const { error } = await supabase
      .from("users")
      .update({
        full_name: data.fullName,
        phone: data.phone,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (error) throw error;
  },

  async checkIsAdmin() {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return data;
  },
};
