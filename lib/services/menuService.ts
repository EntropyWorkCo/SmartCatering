import { Buffer } from "buffer";
import { supabase } from "../supabase";
import { notificationService } from "./notificationService";

export const menuService = {
  async getActiveMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .in("status", ["active", "sold_out"])
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
        { name, category, price, image_url: finalImageUrl || null, is_active: false, status: 'passive' }
      ])
      .select();
    if (error) throw error;
    return data;
  },

  async deleteMenuItem(id: string) {
    const { error } = await supabase
      .from("menu_items")
      .update({ status: 'archived', is_active: false })
      .eq("id", id);
    if (error) throw error;
  },

  async toggleItemStatus(id: string, newStatus: 'passive' | 'active' | 'sold_out' | 'draft') {
    const { error } = await supabase
      .from("menu_items")
      .update({ status: newStatus, is_active: newStatus === 'active' })
      .eq("id", id);
    if (error) throw error;
  },

  async publishDraftMenu() {
    const { error } = await supabase
      .from("menu_items")
      .update({ status: 'active', is_active: true })
      .eq("status", "draft");
    if (error) throw error;

    try {
      // Kendiniz (Admin) test ederken bildirimi alabilsin diye excludeAdmins parametresi false geçildi.
      const tokens = await notificationService.getPushTokens(undefined, false);
      if (tokens && tokens.length > 0) {
        await notificationService.sendPushNotification(
          tokens,
          "Günün Menüsü Hazır! 🍽️",
          "Lezzetli yemeklerimiz sizi bekliyor. Hemen menüye göz atın ve siparişinizi verin!",
          { url: "/(tabs)/menu" }
        );
      }
    } catch (e) {
      console.log("Menü yayınlama bildirimi gönderilirken hata oluştu:", e);
    }
  },

  async updateMenuItem(id: string, data: { name: string; price: number; category: string; image_url?: string; image_base64?: string }) {
    let finalImageUrl = data.image_url;

    if (data.image_base64) {
      try {
        const ext = data.image_url ? data.image_url.substring(data.image_url.lastIndexOf(".") + 1) : "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const uploadData = Buffer.from(data.image_base64, "base64");

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(fileName, uploadData, {
            contentType: `image/${ext}`,
          });

        if (uploadError) {
          console.warn("Resim yükleme hatası:", uploadError);
        } else {
          const { data: publicData } = supabase.storage
            .from("menu-images")
            .getPublicUrl(fileName);
          finalImageUrl = publicData.publicUrl;
        }
      } catch (err) {
        console.warn("Resim decode/upload hatası:", err);
      }
    }

    const updatePayload: any = {
      name: data.name,
      price: data.price,
      category: data.category
    };

    if (finalImageUrl !== undefined) {
      updatePayload.image_url = finalImageUrl;
    }

    const { error } = await supabase
      .from("menu_items")
      .update(updatePayload)
      .eq("id", id);
    if (error) throw error;
  },

  async getSystemPrices() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("status", "sistem_fiyati")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAllMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .neq("status", "sistem_fiyati")
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
};
