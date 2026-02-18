import { supabase } from "./supabase";

// YARDIMCI: Telefonu Email formatına çevirir
const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  // DİKKAT: Buradaki işaretler klavyedeki "Alt Gr + ," ile yapılan ters tırnaktır.
  return `${cleanPhone}@meydan.app`;
};

// 1. KAYIT OLMA
export const registerUser = async (params: {
  adSoyad: string;
  telefon: string;
  password: string;
  isKurumsal: boolean;
  firmaUnvani?: string;
  vergiNo?: string;
}) => {
  const email = formatPhoneToEmail(params.telefon);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: params.password,
  });

  if (authError) return { success: false, error: authError.message };

  if (authData.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      ad_soyad: params.adSoyad,
      telefon: params.telefon,
      is_kurumsal: params.isKurumsal,
      firma_unvani: params.isKurumsal ? params.firmaUnvani : null,
      vergi_no: params.isKurumsal ? params.vergiNo : null,
      bakiye: 0,
    });

    if (profileError) return { success: false, error: profileError.message };
  }

  return { success: true, data: authData };
};

// 2. GİRİŞ YAPMA
export const loginUser = async (telefon: string, password: string) => {
  const email = formatPhoneToEmail(telefon);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) return { success: false, error: error.message };

  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return { success: true, data: data, profile: profile };
  }

  return { success: true, data };
};
