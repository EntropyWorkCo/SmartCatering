import { supabase } from "../supabase";

export const menuService = {
  async getActiveMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};
