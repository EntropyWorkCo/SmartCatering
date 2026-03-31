import { supabase } from "../supabase";

export const adisyonService = {
  async createOrder(userId: string, totalAmount: number, items: any[], orderType: string = "Şimdi Ye", note: string = "", isCorporate: boolean = false) {
    // 1. Adisyon Başlığı
    const { data: adisyon, error: adisyonError } = await supabase
      .from("adisyon")
      .insert([
        { user_id: userId, total_amount: isCorporate ? 0 : totalAmount, status: "PENDING", order_type: orderType, note: note },
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
      unit_price: isCorporate ? 0 : item.price,
      line_total: isCorporate ? 0 : (item.quantity * item.price),
      selections: item.selections || null
    }));

    const { error: itemsError } = await supabase
      .from("adisyon_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Adisyon_Items Insert Error:", itemsError);
      throw itemsError;
    }

    // 3. Bildirim Tetikleyicileri
    try {
        const { notificationService } = require("./notificationService");
        
        // - Puanlama Bildirimi Planla (Sadece Şimdi Ye)
        if (orderType === "Şimdi Ye") {
            notificationService.scheduleRatingNotification(15, adisyon.id);
        }

        // - Admin'e Canlı Sipariş Bildirimi Gönder (Sadece Paket ve Sipariş Ver için)
        if (orderType !== "Şimdi Ye") {
            (async () => {
                try {
                    const { data: userData } = await supabase
                        .from("users")
                        .select("full_name")
                        .eq("id", userId)
                        .single();

                    const adminTokens = await notificationService.getAdminPushTokens();
                    if (adminTokens.length > 0) {
                       await notificationService.sendPushNotification(
                           adminTokens,
                           "Yeni Sipariş Alındı! 🛎️",
                           `${userData?.full_name || "Bir müşteri"} yeni bir sipariş verdi.`,
                           { url: "/(admin)/dashboard" }
                       );
                    }
                } catch (err) {
                    console.error("Admin bildirimi hatası:", err);
                }
            })();
        }
    } catch (e) {
        console.warn("Otomatik bildirim hatası (Kritik değil):", e);
    }

    return adisyon;
  },

  async getUserOrders(userId: string) {
    try {
      const { data, error } = await supabase
        .from("adisyon")
        .select("*, adisyon_items(*, menu_items(name)), users(*, companies!users_company_id_fkey(*))")
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
        .select("*, adisyon_items(*, menu_items(name)), users(*)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("getAllOrders Error:", error);
        throw error;
      }

      return (data || []).map((order: any) => {
        const user = order.users?.[0] || order.users;
        const company = user?.["companies!users_company_id_fkey"]?.[0] || user?.["companies!users_company_id_fkey"] || user?.companies?.[0] || user?.companies;

        return {
          ...order,
          userName: user?.full_name || 'Müşteri',
          companyId: company?.id || null,
          companyName: company?.company_name || null,
          companyBalance: company?.balance || 0,
          isCorporate: !!company || user?.is_company === true,
          isOwner: company?.user_id === user?.id
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

    const userId = data.user_id;
    const { notificationService } = require("./notificationService");
    const isDelivery = data.order_type === 'Sipariş Ver' || data.order_type === 'PAKET';

    // 1. Durum: Hazırlanıyor (Müşteriye "Siparişiniz Alındı" bilgisi)
    if (status === 'PREPARING' || status === 'HAZIRLANIYOR') {
      try {
        const tokens = await notificationService.getPushTokens(userId);
        if (tokens.length > 0) {
          await notificationService.sendPushNotification(
            tokens,
            "Siparişiniz Alındı 👨‍🍳",
            "Yemeğiniz hazırlanmaya başladı. Afiyet olsun!",
            { url: "/(tabs)/past-orders" }
          );
        }
      } catch (err) {
        console.error("Hazırlanıyor bildirimi hatası:", err);
      }
    }

    // 2. Durum: Yola Çıktı (Sadece Paket/Sipariş Ver modunda)
    if ((status === 'READY' || status === 'Hazır' || status === 'HAZIR') && isDelivery) {
      try {
        const tokens = await notificationService.getPushTokens(userId);
        if (tokens.length > 0) {
          /* 
          // NOT: Bu bildirim artık mevcut Firebase backend tarafından yönetiliyor. 
          // Çifte bildirim olmaması için buradan kaldırıldı.
          await notificationService.sendPushNotification(
            tokens,
            `Siparişiniz Yola Çıktı! 🛵`,
            `Yemeğiniz hazırlandı ve şu an yola çıktı. Afiyet olsun!`,
            { url: "/(tabs)/past-orders" }
          );
          */
        }
      } catch (err) {
        console.error("Yola çıktı bildirimi hatası:", err);
      }
    }

    // 3. Durum: Teslim Edildi (Müşteriye Puanlama Hatırlatması)
    if (status === 'COMPLETED' || status === 'TAMAMLANDI') {
      try {
        const tokens = await notificationService.getPushTokens(userId);
        if (tokens.length > 0) {
          /* 
          // NOT: Bu bildirim artık mevcut Firebase backend tarafından yönetiliyor. 
          // Çifte bildirim olmaması için buradan kaldırıldı.
          await notificationService.sendPushNotification(
            tokens,
            "Siparişiniz Teslim Edildi ✅",
            "Afiyet olsun! Bugünkü siparişinizi değerlendirmek ister misiniz?",
            { url: `/(tabs)/order-rating?orderId=${data.id}` }
          );
          */
        }
      } catch (err) {
        console.error("Değerlendirme bildirim gönderme hatası:", err);
      }
    }

    return data;
  },

  async clearUserDebt(userId: string) {
    const { error } = await supabase
      .from("adisyon")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .not("status", "in", '("CANCELLED","İptal","PAID","Ödendi","COMPLETED","Tamamlandı")');

    if (error) {
      console.error("clearUserDebt error:", error);
      throw error;
    }
  },

  async getCompanyOrders(companyId: string) {
    try {
      // 1. Get company owner id
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("user_id")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      // 2. Get all employees in the company
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", companyId);

      if (userError) throw userError;

      const userIds = users.map(u => u.id);
      if (company?.user_id) {
        userIds.push(company.user_id);
      }

      if (userIds.length === 0) return [];

      // 3. Fetch adisyons for these user IDs
      const { data: adisyons, error: adisyonError } = await supabase
        .from("adisyon")
        .select(`
          *,
          users (*, companies!users_company_id_fkey(*)),
          adisyon_items (*, menu_items(name))
        `)
        .in("user_id", userIds)
        .order("created_at", { ascending: false });

      if (adisyonError) throw adisyonError;

      // Map format similarly to getAllOrders to be displayed uniformly
      return (adisyons || []).map((order: any) => {
        const user = order.users?.[0] || order.users;
        const company = user?.["companies!users_company_id_fkey"]?.[0] || user?.["companies!users_company_id_fkey"] || user?.companies?.[0] || user?.companies;
        return {
          ...order,
          userName: user?.full_name || 'Müşteri',
          companyName: company?.company_name || null,
          isCorporate: !!company
        };
      });

    } catch (error: any) {
      console.error("getCompanyOrders error:", error);
      throw error;
    }
  }
};
