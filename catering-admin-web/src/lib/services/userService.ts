import { v4 as uuidv4 } from 'uuid';
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
        id: companyData.id,
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
  async updateProfile(userId: string, data: { fullName: string, phone: string }) {
    const { error } = await supabase
      .from("users")
      .update({
        full_name: data.fullName,
        phone: data.phone,
      })
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
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async addEmployee(companyId: string, fullName: string, phone: string, role: string = "customer", isCompany: boolean = true) {
    const id = uuidv4();
    const { error } = await supabase
      .from("users")
      .insert({
        id,
        full_name: fullName,
        phone,
        company_id: companyId,
        is_company: isCompany,
        role
      });
    if (error) throw error;
    return id;
  },

  async deleteEmployee(employeeId: string) {
    // Unlink the employee from the company rather than hard deleting the user row, 
    // to preserve adisyon history and avoid FK violation if any exist.
    const { error } = await supabase
      .from("users")
      .update({ company_id: null, is_company: false, role: "customer" })
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
