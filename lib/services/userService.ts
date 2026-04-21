import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "../supabase";

export const userService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null; // Kullanıcı veritabanında yoksa null dön

    // Şirket bilgilerini çek ve profile ekle
    const { data: companyData } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (companyData) {
      (data as any).corporate_info = {
        id: companyData.id,
        companyName: companyData.company_name,
        taxNumber: companyData.tax_number,
        companyPhone: companyData.company_phone,
        invoiceAddress: companyData.address
      };
    } else if (data.is_company === true || (data as any).role === 'corporate') {
      // Kayıt henüz yoksa boş bir yapı ekle ki UI'da görünsün ve düzenlenebilsin
      (data as any).corporate_info = {
        id: null,
        companyName: "",
        taxNumber: "",
        companyPhone: "",
        invoiceAddress: ""
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

    // KRİTİK: Kullanıcıyı kurumsal olarak işaretle (is_company flag'ini güncelle)
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({
        is_company: true,
        role: "corporate"
      } as any) // Type error'u önlemek için as any kullanıyoruz (database.types güncellenecek)
      .eq("id", userId);

    if (userUpdateError) {
      console.error("User tablosu güncellenirken hata:", userUpdateError);
    }
  },
  async updateProfile(userId: string, data: { fullName: string, phone: string, address?: string }) {
    const { error } = await supabase
      .from("users")
      .update({
        full_name: data.fullName,
        phone: data.phone,
        ...(data.address !== undefined ? { address: data.address } : {}),
      } as any)
      .eq("id", userId);

    if (error) throw error;
  },

  async checkIsAdmin() {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return data;
  },

  async updatePushToken(userId: string, token: string) {
    const { error } = await supabase
      .from("users")
      .update({ push_token: token })
      .eq("id", userId);

    if (error) {
      console.error("Error updating push token:", error);
      throw error;
    }
  },

  async downgradeToIndividual(userId: string) {
    // 1. Users tablosunu güncelle
    const { error: userError } = await supabase
      .from("users")
      .update({
        is_company: false,
        role: "customer"
      } as any)
      .eq("id", userId);

    if (userError) throw userError;

    // 2. Şirket bilgisini sil (veya tutmak istersen silme, ama genellikle temizlenir)
    const { error: companyError } = await supabase
      .from("companies")
      .delete()
      .eq("user_id", userId);

    if (companyError) {
      console.error("Şirket silinirken hata (downgrade):", companyError);
    }
  },

  async getCompanyEmployees(companyId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("company_id", companyId)
      .neq("role", "deleted")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async addEmployee(
    companyId: string,
    fullName: string,
    phone: string,
    role: string = "customer",
    isCompany: boolean = true
  ) {
    console.log("AddEmployee Başlatıldı:", { companyId, fullName, phone });
    const { data, error } = await (supabase.rpc as any)("upsert_employee", {
      p_company_id: companyId,
      p_full_name: fullName,
      p_is_company: isCompany,
      p_phone: phone,
      p_role: role
    });

    if (error) {
      console.error("Çalışan ekleme/güncelleme hatası:", error);
      throw error;
    }
    
    console.log("AddEmployee Başarılı. Kayıt ID:", data);
    return data;
  },


  async deleteEmployee(employeeId: string) {
    // Soft delete by setting role to "deleted". We keep company_id intact because
    // updating it to null violates the Row-Level Security policy for company owners.
    const { error } = await supabase
      .from("users")
      .update({ role: "deleted" })
      .eq("id", employeeId);
      
    if (error) throw error;
  },

  async uploadEmployeesCSV(companyId: string, employees: { fullName: string, phone: string }[]) {
    if (employees.length === 0) return;
    const rows = employees.map(emp => ({
      id: uuidv4(),
      full_name: emp.fullName,
      phone: emp.phone,
      company_id: companyId,
      is_company: true,
      role: "customer"
    }));

    const { error } = await supabase
      .from("users")
      .insert(rows);
      
    if (error) throw error;
  }
};
