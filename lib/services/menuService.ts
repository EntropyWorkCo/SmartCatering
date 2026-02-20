import { supabase } from "../supabase";

export const getMenu = async () => {
  console.log("API ÇAĞRILDI");

  const { data, error } = await supabase.from("menu_items").select("*");

  console.log("DATA:", data);
  console.log("ERROR:", error);

  return data ?? [];
};
