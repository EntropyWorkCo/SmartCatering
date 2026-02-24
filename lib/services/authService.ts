// lib/services/authService.ts
import { supabase } from "../supabase";

// YARDIMCI: Telefonu Email formatına çevirir (SMS masrafından kaçınmak için)
const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  // Meydan app yerine kendi uygulamanın adını yazabilirsin
  return `${cleanPhone}@smartcatering.app`;
};

export const authService = {
  // 1. KAYIT OLMA
  async registerUser(params: {
    adSoyad: string;
    telefon: string;
    password: string;
    isKurumsal: boolean;
    firmaUnvani?: string;
    vergiNo?: string;
  }) {
    const email = formatPhoneToEmail(params.telefon);

    // 1. Supabase Auth'a (Sisteme) Kayıt
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: params.password,
    });

    if (authError) throw authError;

    if (authData.user) {
      // 2. 'users' tablosuna genel profil bilgilerini kaydet
      const { error: userError } = await supabase.from("users").insert({
        id: authData.user.id,
        full_name: params.adSoyad,
        phone: params.telefon,
        // İsteğe bağlı: isKurumsal true ise rolü corporate yapabilirsin
        role: params.isKurumsal ? "corporate" : "customer",
      });

      if (userError) throw userError;

      // 3. Eğer kullanıcı kurumsalsa, ekstra olarak 'companies' tablosuna kaydet
      if (params.isKurumsal && params.firmaUnvani && params.vergiNo) {
        const { error: companyError } = await supabase
          .from("companies")
          .insert({
            user_id: authData.user.id,
            company_name: params.firmaUnvani,
            tax_number: params.vergiNo,
            // Senin veritabanında adres ve telefon zorunlu olduğu için varsayılan değer atıyoruz
            address: "Belirtilmedi",
            company_phone: params.telefon,
          });

        if (companyError) throw companyError;
      }
    }

    return authData;
  },

  // 2. GİRİŞ YAPMA
  async loginUser(telefon: string, password: string) {
    const email = formatPhoneToEmail(telefon);

    // Auth tablosundan giriş kontrolü
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;
    return data;
  },

  // 3. ÇIKIŞ YAPMA
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
