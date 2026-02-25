import { supabase } from "./supabase";

const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `${cleanPhone}@meydan.app`;
};

export const registerUser = async (params: {
  adSoyad: string;
  telefon: string;
  password: string;
  is_company?: boolean;
}) => {
  const cleanPhone = params.telefon.replace(/[^0-9]/g, "");
  const email = formatPhoneToEmail(cleanPhone);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: {
      data: {
        full_name: params.adSoyad,
        phone: cleanPhone,
        is_company: !!params.is_company,
        role: "customer",
      },
    },
  });

  if (authError) return { success: false, error: authError.message };

  // OTOMATİK YÖNLENDİRME: Eğer email confirmation kapalıysa session anında gelir.
  return { success: true, data: authData };
};

export const loginUser = async (telefon: string, password: string) => {
  const email = formatPhoneToEmail(telefon);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};
