import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "../supabase";

const SUPABASE_URL = "https://vruwzmljqfvnerenwzpy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

/**
 * Çalışan eklendikten sonra hoş geldin SMS'i gönderir.
 * Hata olsa bile ana akışı bozmaz (fire-and-forget).
 */
async function sendWelcomeSms(phone: string, employeeName: string, companyId: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ phone, employeeName, companyId }),
    });

    const result = await response.json();
    if (result.success) {
      console.log(`Hoş geldin SMS'i gönderildi → ${phone} (${employeeName})`);
    } else {
      console.warn('Hoş geldin SMS’i gönderilemedi:', result.error);
    }
  } catch (e) {
    console.warn('sendWelcomeSms hatası (kritik değil):', e);
  }
}

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
    } else if (data.is_company === true || (data as any).role === 'owner' || (data as any).role === 'corporate') {
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
        role: "owner"
      } as any)
      .eq("id", userId);

    if (userUpdateError) {
      console.error("User tablosu güncellenirken hata:", userUpdateError);
    }
  },
  async updateProfile(userId: string, data: { fullName: string, phone: string, address?: string }) {
    try {
      // 1. Public tabloyu güncelle
      const { error } = await supabase
        .from("users")
        .update({
          full_name: data.fullName,
          phone: data.phone,
          ...(data.address !== undefined ? { address: data.address } : {}),
        } as any)
        .eq("id", userId);

      if (error) throw error;

      // 2. Auth metadata'yı senkronize et (İsmi her iki yerde de aynı görmek için)
      await supabase.auth.updateUser({
        data: { full_name: data.fullName }
      });

    } catch (error) {
      console.error("updateProfile hatası:", error);
      throw error;
    }
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
    if (!companyId) return [];
    
    try {
      // Daha geniş bir sorgu: Sadece company_id değil, hata payını azaltmak için fetch'i güçlendiriyoruz
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, phone, role, created_at, company_id, is_company")
        .eq("company_id", companyId)
        .neq("role", "deleted")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("GetCompanyEmployees Error:", error);
        throw error;
      }
      
      // console.log(`${companyId} için ${data?.length || 0} çalışan bulundu.`);
      return data || [];
    } catch (err: any) {
      console.error("getCompanyEmployees unexpected error:", err);
      return [];
    }
  },

  async addEmployee(
    companyId: string,
    fullName: string,
    phone: string,
    role: string = "customer",
    isCompany: boolean = true
  ) {
    // 1. Firmanın adresini önceden çek (çalışana otomatik atanacak)
    let companyAddress: string | null = null;
    try {
      const { data: companyData } = await supabase
        .from("companies")
        .select("address")
        .eq("id", companyId)
        .maybeSingle();
      companyAddress = companyData?.address?.trim() || null;
    } catch (e) {
      console.warn("Firma adresi çekilirken hata (kritik değil):", e);
    }

    // 2. RPC ile ekle (Şifreleme ve Auth işlemleri için)
    const { data, error: rpcError } = await (supabase.rpc as any)("upsert_employee", {
      p_company_id: companyId,
      p_full_name: fullName,
      p_is_company: isCompany,
      p_phone: phone,
      p_role: role
    });

    if (rpcError) {
        console.error("AddEmployee RPC Hatası:", rpcError);
        throw rpcError;
    }

    // 3. DOĞRUDAN GÜNCELLEME (ID Üzerinden Kesin Eşleşme)
    // RPC bazen 'data' olarak yeni eklenen kullanıcının ID'sini döndürür.
    const newUserId = data?.id || data;

    const updatePayload: Record<string, any> = {
      company_id: companyId,
      is_company: true,
      role: role,
      ...(companyAddress ? { address: companyAddress } : {}),
    };

    if (newUserId && typeof newUserId === 'string' && newUserId.length > 20) {
        try {
            await supabase
                .from("users")
                .update(updatePayload)
                .eq("id", newUserId);
        } catch (e) {
            console.warn("ID bazlı güncelleme hatası:", e);
        }
    } else {
        // Fallback: Telefon ile güncelle
        try {
            await supabase
                .from("users")
                .update(updatePayload)
                .eq("phone", phone);
        } catch (e) {
            console.warn("Fallback güncelleme hatası:", e);
        }
    }

    console.log("AddEmployee Başarılı. Kayıt ID:", data);

    // 3. Hoş geldin SMS'i gönder (fire-and-forget — hata olsa çalışan kaydını bozmaz)
    sendWelcomeSms(phone, fullName, companyId);

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

    // Firmanın adresini çek; toplu eklenen çalışanlara otomatik atanacak
    let companyAddress: string | null = null;
    try {
      const { data: companyData } = await supabase
        .from("companies")
        .select("address")
        .eq("id", companyId)
        .maybeSingle();
      companyAddress = companyData?.address?.trim() || null;
    } catch (e) {
      console.warn("CSV yükleme - firma adresi çekilirken hata (kritik değil):", e);
    }

    const rows = employees.map(emp => ({
      id: uuidv4(),
      full_name: emp.fullName,
      phone: emp.phone,
      company_id: companyId,
      is_company: true,
      role: "customer",
      ...(companyAddress ? { address: companyAddress } : {}),
    }));

    const { error } = await supabase
      .from("users")
      .insert(rows);
      
    if (error) throw error;

    // Toplu ekleme başarılı → her çalışana hoş geldin SMS'i gönder
    // Fire-and-forget: SMS hatası kayıt akışını bozmaz
    for (const emp of employees) {
      sendWelcomeSms(emp.phone, emp.fullName, companyId);
    }
  }
};
