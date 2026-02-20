import { supabase } from "../supabase";

export const adminLogin = async (email: string, accessCode: string) => {
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", email)
    .eq("access_code", accessCode)
    .single();

  if (error) throw error;

  return data;
};
