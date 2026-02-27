import { Buffer } from "buffer";
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

  async addMenuItem(name: string, category: string, price: number, image_url?: string, image_base64?: string) {
    let finalImageUrl = image_url;

    if (image_base64) {
      try {
        const ext = image_url ? image_url.substring(image_url.lastIndexOf(".") + 1) : "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const uploadData = Buffer.from(image_base64, "base64");

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(fileName, uploadData, {
            contentType: `image/${ext}`,
          });

        if (uploadError) {
          console.warn("Resim yükleme hatası:", uploadError);
          finalImageUrl = undefined;
        } else {
          const { data: publicData } = supabase.storage
            .from("menu-images")
            .getPublicUrl(fileName);
          finalImageUrl = publicData.publicUrl;
        }
      } catch (err) {
        console.warn("Resim decode/upload hatası:", err);
        finalImageUrl = undefined;
      }
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert([
        { name, category, price, image_url: finalImageUrl || null, is_active: true }
      ])
      .select();
    if (error) throw error;
    return data;
  },

  async deleteMenuItem(id: string) {
    const { error } = await supabase
      .from("menu_items")
      .update({ is_active: false }) // Soft delete
      .eq("id", id);
    if (error) throw error;
  }
};
