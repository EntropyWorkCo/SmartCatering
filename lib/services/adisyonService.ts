import * as Notifications from 'expo-notifications';
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

    // Yemeği Değerlendir Local Notification (10 saniye test süresi)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Yemeğiniz nasıldı? 🍽️",
          body: "Siparişinizi afiyetle yediğinizi umuyoruz! Menüyü ve yemekleri değerlendirmek ister misiniz?",
          data: { url: "/rating" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 15 * 60, // 15 dakika sonra tetiklenir
          repeats: false
        },
      });
    } catch (e) {
      console.log("Local notification schedule error:", e);
    }

    return adisyon;
  },

  async getUserOrders(userId: string) {
    try {
      const { data, error } = await supabase
        .from("adisyon")
        .select("*, adisyon_items(*, menu_items(name)), users(*, companies(*))")
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
        .select("*, adisyon_items(*, menu_items(name)), users(*, companies(*))")
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
    const { data, error } = await supabase
      .from("adisyon")
      .update({ status })
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
