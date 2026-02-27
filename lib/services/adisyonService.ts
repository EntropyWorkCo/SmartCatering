import { supabase } from "../supabase";

export const adisyonService = {
  async createOrder(userId: string, totalAmount: number, items: any[]) {
    // 1. Adisyon Başlığı
    const { data: adisyon, error: adisyonError } = await supabase
      .from("adisyon")
      .insert([
        { user_id: userId, total_amount: totalAmount, status: "bekliyor" },
      ])
      .select()
      .single();

    if (adisyonError) throw adisyonError;

    // 2. Adisyon Kalemleri
    const orderItems = items.map((item) => ({
      adisyon_id: adisyon.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.quantity * item.price,
    }));

    const { error: itemsError } = await supabase
      .from("adisyon_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;
    return adisyon;
  },

  async getUserOrders(userId: string) {
    const { data, error } = await supabase
      .from("adisyon")
      .select("*, adisyon_items(*, menu_items(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
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
