import { supabase } from "./supabase";

const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `${cleanPhone}@meydan.app`;
};

// KAYIT OLMA (Müşteriler için)
export const registerUser = async (params: {
  adSoyad: string;
  telefon: string;
  password: string;
}) => {
  const email = formatPhoneToEmail(params.telefon);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: params.password,
  });

  if (authError) return { success: false, error: authError.message };

  if (authData.user) {
    // Sütun isimlerini veritabanındaki (full_name, phone) isimlerle eşleştirdik
    const { error } = await supabase.from("users").insert({
      id: authData.user.id,
      full_name: params.adSoyad,
      phone: params.telefon,
      role: "customer",
    });
    if (error) return { success: false, error: error.message };
  }
  return { success: true, data: authData };
};

// GİRİŞ YAPMA
export const loginUser = async (telefon: string, password: string) => {
  const email = formatPhoneToEmail(telefon);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};
// lib/auth.ts dosyasına ekle:
export const loginAdmin = async (email: string, code: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email, // Adminin gerçek maili
    password: code, // Şifresi
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};
