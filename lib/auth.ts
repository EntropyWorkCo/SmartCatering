import { supabase } from './supabase';

// YARDIMCI: Telefonu Email formatına çevirir (Hile)
// Örn: "0555 123" -> "0555123@meydan.app"
const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, ''); 
  return ${cleanPhone}@meydan.app;
};

// 1. KAYIT OLMA (Register Ekranındaki "Hesabımı Oluştur" butonu)
export const registerUser = async (params: {
  adSoyad: string;
  telefon: string;
  password: string;
  isKurumsal: boolean; // Checkbox seçili mi?
  firmaUnvani?: string;
  vergiNo?: string;
}) => {
  
  // 1. Telefonu gizli maile çevir
  const email = formatPhoneToEmail(params.telefon);

  // 2. Supabase Auth Kaydı (Şifre burada tutulur)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: params.password,
  });

  if (authError) return { success: false, error: authError.message };

  // 3. Profil Tablosuna Yazma (Ekrandaki diğer bilgiler)
  if (authData.user) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      ad_soyad: params.adSoyad,
      telefon: params.telefon,
      
      // Kurumsal mantığı
      is_kurumsal: params.isKurumsal,
      // Eğer checkbox seçiliyse firma bilgilerini yaz, değilse NULL yaz
      firma_unvani: params.isKurumsal ? params.firmaUnvani : null,
      vergi_no: params.isKurumsal ? params.vergiNo : null,
      
      bakiye: 0
    });

    if (profileError) return { success: false, error: profileError.message };
  }

  return { success: true, data: authData };
};

// 2. GİRİŞ YAPMA (Login Ekranındaki "Oturum Aç" butonu)
export const loginUser = async (telefon: string, password: string) => {
  // Kullanıcı sadece telefon girer, biz arkada maile çevirip sorarız
  const email = formatPhoneToEmail(telefon);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) return { success: false, error: error.message };
  
  // Giriş başarılı, şimdi rolünü öğrenelim (Admin mi Müşteri mi?)
  if (data.user) {
     const { data: profile } = await supabase
       .from('profiles')
       .select('*')
       .eq('id', data.user.id)
       .single();
       
     return { success: true, data: data, profile: profile };
  }

  return { success: true, data };
};