import { supabase } from "../supabase";

export const adisyonService = {
  async createOrder(userId: string, totalAmount: number, items: any[], orderType: string = "Şimdi Ye", note: string = "") {
    // 1. Adisyon Başlığı
    const { data: adisyon, error: adisyonError } = await supabase
      .from("adisyon")
      .insert([
        { user_id: userId, total_amount: totalAmount, status: "PENDING", order_type: orderType, note: note },
      ])
      .select()
      .single();

    if (adisyonError) {
      console.error("Adisyon Insert Error:", adisyonError);
      throw adisyonError;
    }

    // Insert note into messages table if it exists and isn't just the default "Sipariş Türü: Şimdi Ye"
    // The cart sends: `Sipariş Türü: ${orderType}${orderNote ? ` - Not: ${orderNote}` : ""}`
    if (note && note.includes(" - Not: ")) {
      const { error: messageError } = await supabase
        .from("messages")
        .insert([
          { user_id: userId, content: note, is_from_admin: false, is_read: false }
        ]);

      if (messageError) {
        console.error("Yorum/Not mesaja dönüştürülemedi:", messageError);
      }
    }

    // 2. Adisyon Kalemleri
    const orderItems = items.map((item) => ({
      adisyon_id: adisyon.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.quantity * item.price,
      selections: item.selections || null
    }));

    const { error: itemsError } = await supabase
      .from("adisyon_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Adisyon_Items Insert Error:", itemsError);
      throw itemsError;
    }

    return adisyon;
  },

  async getUserOrders(userId: string) {
    try {
      const { data, error } = await supabase
        .from("adisyon")
        .select("*, adisyon_items(*, menu_items(name)), users(*, companies!companies_user_id_fkey(*))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Adisyon Select Error:", error);
        throw error;
      }
      return data || [];
    } catch (error: any) {
      console.error("getUserOrders error:", error);
      throw error;
    }
  },

  async getAllOrders() {
    try {
      const { data, error } = await supabase
        .from("adisyon")
        .select("*, adisyon_items(*, menu_items(name)), users(*, companies!companies_user_id_fkey(*))")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("getAllOrders Error:", error);
        throw error;
      }

      return (data || []).map((order: any) => {
        const user = order.users?.[0] || order.users;
        const company = user?.companies?.[0] || user?.companies;

        return {
          ...order,
          userName: user?.full_name || 'Müşteri',
          companyName: company?.company_name || null,
          isCorporate: !!company
        };
      });
    } catch (error: any) {
      console.error("getAllOrders error:", error);
      throw error;
    }
  },

  async updateOrderStatus(orderId: string, status: string) {
    const updateData: any = { status };
    if (status === 'PAID') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("adisyon")
      .update(updateData)
      .eq("id", orderId)
      .select("*, users(*)")
      .single();

    if (error) throw error;

    // "Hazır" durumuna geçtiğinde kullanıcıya bildirim gönder
    if (status === 'READY' || status === 'Hazır' || status === 'HAZIR') {
      try {
        const userId = data.user_id;
        const { notificationService } = require("./notificationService");
        const tokens = await notificationService.getPushTokens(userId);
        if (tokens.length > 0) {
          const typeLabel = 'Siparişiniz';
          await notificationService.sendPushNotification(
            tokens,
            `🍽️ ${typeLabel} Hazır!`,
            `Siparişiniz hazırlandı ve sizi bekliyor. Afiyet olsun!`,
            { type: "order_ready", orderId: data.id }
          );
        }
      } catch (err) {
        console.error("Bildirim gönderme hatası:", err);
      }
    }

    return data;
  }
};
