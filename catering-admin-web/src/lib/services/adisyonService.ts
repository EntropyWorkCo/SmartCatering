import { supabase } from "../supabase";
import { notificationService } from "./notificationService";

export const adisyonService = {
  async createOrder(userId: string, totalAmount: number, items: any[], orderType: string = "Şimdi Ye", note: string = "", isCorporate: boolean = false) {
    const { data: adisyon, error: adisyonError } = await supabase
      .from("adisyon")
      .insert([
        { user_id: userId, total_amount: isCorporate ? 0 : totalAmount, status: "PENDING", order_type: orderType, note: note },
      ])
      .select()
      .single();

    if (adisyonError) throw adisyonError;

    if (note && note.includes(" - Not: ")) {
      await supabase.from("messages").insert([{ user_id: userId, content: note, is_from_admin: false, is_read: false }]);
    }

    const orderItems = items.map((item) => ({
      adisyon_id: adisyon.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: isCorporate ? 0 : item.price,
      line_total: isCorporate ? 0 : (item.quantity * item.price),
      selections: item.selections || null
    }));

    const { error: itemsError } = await supabase.from("adisyon_items").insert(orderItems);
    if (itemsError) throw itemsError;

    try {
        (async () => {
            try {
                const { data: userData } = await supabase.from("users").select("full_name").eq("id", userId).single();
                const adminTokens = await notificationService.getPushTokens(undefined as any, false);
                if (adminTokens.length > 0) {
                   await notificationService.sendPushNotification(adminTokens, "Yeni Sipariş Alındı! 🛎️", `${userData?.full_name || "Bir müşteri"} yeni bir sipariş verdi.`);
                }
            } catch (err) {
                console.error("Admin bildirimi hatası:", err);
            }
        })();
    } catch (e) {
        console.warn("Otomatik bildirim hatası:", e);
    }

    return adisyon;
  },

  async getUserOrders(userId: string) {
    const { data, error } = await supabase
      .from("adisyon")
      .select("*, adisyon_items(*, menu_items(name)), users(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAllOrders() {
    const { data: orders, error: ordersError } = await supabase
      .from("adisyon")
      .select("*, adisyon_items(*, menu_items(name)), users(*)")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // Fetch all companies to map owners and employees correctly (same as mobile logic)
    const { data: companies, error: companiesError } = await supabase.from("companies").select("*");
    if (companiesError) throw companiesError;

    return (orders || []).map((order: any) => {
      const user = order.users?.[0] || order.users;
      
      // Find company: 
      // 1. By company_id (employee)
      // 2. By user_id (owner)
      const company = companies?.find(c => c.id === user?.company_id || c.user_id === user?.id);

      return {
        ...order,
        userName: user?.full_name || 'Müşteri',
        companyName: company?.company_name || null,
        isCorporate: !!company
      };
    });
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

    const userId = data.user_id;
    const isDelivery = data.order_type === 'Sipariş Ver' || data.order_type === 'PAKET';

    if (['PREPARING', 'HAZIRLANIYOR', 'READY', 'COMPLETED', 'TAMAMLANDI'].includes(status)) {
      try {
        const tokens = await notificationService.getPushTokens(userId || undefined);
        if (tokens.length > 0) {
          let title = "Siparişiniz Alındı 👨‍🍳";
          let body = "Yemeğiniz hazırlanmaya başladı.";
          if (status === 'READY' && isDelivery) { title = "Siparişiniz Yola Çıktı! 🛵"; body = "Yemeğiniz kapınızda!"; }
          else if (status === 'COMPLETED' || status === 'TAMAMLANDI') { title = "Siparişiniz Teslim Edildi ✅"; body = "Afiyet olsun!"; }
          await notificationService.sendPushNotification(tokens, title, body);
        }
      } catch (err) {
        console.error("Bildirim hatası:", err);
      }
    }
    return data;
  },

  async clearUserDebt(userId: string) {
    const { error } = await supabase
      .from("adisyon")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("user_id", userId)
      .not("status", "in", '("CANCELLED","İptal","PAID","Ödendi","COMPLETED","Tamamlandı")');
    if (error) throw error;
  },

  async getCompanyOrders(companyId: string) {
    const { data: companies, error: companiesError } = await supabase.from("companies").select("*");
    if (companiesError) throw companiesError;
    
    const targetCompany = companies?.find(c => c.id === companyId);
    
    // Get all users belonging to this company (owners + employees)
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .or(`company_id.eq.${companyId},id.eq.${targetCompany?.user_id}`);
    
    if (userError) throw userError;
    const userIds = users.map(u => u.id);
    if (userIds.length === 0) return [];

    const { data: orders, error: ordersError } = await supabase
      .from("adisyon")
      .select("*, users(*), adisyon_items(*, menu_items(name))")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    return (orders || []).map((order: any) => {
      const user = order.users?.[0] || order.users;
      const company = companies?.find(c => c.id === user?.company_id || c.user_id === user?.id);
      return {
        ...order,
        userName: user?.full_name || 'Müşteri',
        companyName: company?.company_name || null,
        isCorporate: true
      };
    });
  }
};
