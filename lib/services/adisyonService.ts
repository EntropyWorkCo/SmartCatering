import { supabase } from "../supabase";

// 1️⃣ Adisyonları getir
export const getAdisyonlar = async () => {
  const { data, error } = await supabase.from("adisyonlar").select("*");

  if (error) {
    console.log("Adisyon getirme hatası:", error);
    throw error;
  }

  return data;
};

// 2️⃣ Yeni adisyon ekle
export const addAdisyon = async (adisyon: any) => {
  const { data, error } = await supabase.from("adisyonlar").insert([adisyon]);

  if (error) {
    console.log("Adisyon ekleme hatası:", error);
    throw error;
  }

  return data;
};
