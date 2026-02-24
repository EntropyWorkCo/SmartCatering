import { supabase } from "../supabase";

export const userService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  },
  async checkIsAdmin() {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return data;
  },
};
