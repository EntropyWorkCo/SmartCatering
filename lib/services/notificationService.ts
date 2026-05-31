import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../supabase";

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// ─────────────────────────────────────────────────────────────────────────────
// Edge Function helper — sunucu tarafı push gönderimi (background/killed safe)
// ─────────────────────────────────────────────────────────────────────────────
type NotificationType = "NEW_ORDER" | "ORDER_STATUS" | "RATING_REQUEST" | "DAILY_MENU" | "MEAL_REMINDER";

interface EdgeNotificationOptions {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  userId?: string;       // Belirli bir kullanıcıya
  userIds?: string[];    // Birden fazla kullanıcıya
  adminOnly?: boolean;   // Sadece admin(ler)e
  broadcast?: boolean;   // Herkese
  excludeUserId?: string; // Bu userId'yi hariç tut (örn: sipariş veren kendisiyse)
}

export const notificationService = {
  /**
   * Supabase Edge Function üzerinden push bildirimi gönderir.
   * Bu yöntem sunucu tarafında çalıştığından uygulama kapalı olsa da çalışır.
   */
  async sendViaEdgeFunction(options: EdgeNotificationOptions): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      // access_token yoksa (session henüz yüklenmediyse) anon key ile devam et
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
      const token = sessionData?.session?.access_token ?? ANON_KEY;

      const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(options),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Edge Function push error:", response.status, errText);
      } else {
        const result = await response.json();
        console.log(`[send-notification] ${options.type} sent to ${result.sent} device(s).`);
      }
    } catch (error) {
      console.error("sendViaEdgeFunction error:", error);
    }
  },

  /**
   * Admin'in tüm kullanıcılara veya spesifik bir listeye push bildirim göndermesini sağlar.
   * (Expo Push API'ye doğrudan — uygulama açıkken kısa yol için bırakıldı)
   */
  async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any
  ) {
    if (!tokens || tokens.length === 0) return;
    try {
      const message = {
        to: tokens,
        sound: "default",
        title,
        body,
        data: data || {},
        priority: "high",
        channelId: "default",
      };

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error("Push notification failed:", await response.text());
      }
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  },

  /**
   * Belirli bir kullanıcının veya tüm kullanıcıların push tokenlarını getirir
   */
  async getPushTokens(userId?: string, excludeAdmins: boolean = true): Promise<string[]> {
    try {
      let query = (supabase
        .from("users") as any)
        .select("push_token, role")
        .not("push_token", "is", null);

      if (userId) {
        query = query.eq("id", userId);
      } else if (excludeAdmins) {
        query = query.neq("role", "admin");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching push tokens:", error);
        return [];
      }

      return (data as any[])
        .map((user: any) => user.push_token)
        .filter(
          (token: any): token is string =>
            Boolean(token && typeof token === "string" && token.trim().length > 0)
        );
    } catch (error) {
      console.error("Error in getPushTokens:", error);
      return [];
    }
  },

  /**
   * Sipariş tamamlandığında müşteriye uzaktan (remote) değerlendirme bildirimi gönderir.
   * Uygulama kapalı olsa da FCM/APNs üzerinden gelir.
   */
  async sendRatingNotification(userId: string, orderId: string) {
    await this.sendViaEdgeFunction({
      type: "RATING_REQUEST",
      title: "Yemeğiniz nasıldı? 🍽️",
      body: "Bugünkü siparişinizi değerlendirerek bize yardımcı olmak ister misiniz?",
      data: {
        // expo-router deep link — tıklandığında order-rating sayfasına gider
        url: `/order-rating?orderId=${orderId}`,
        screen: "order-rating",
        orderId,
      },
      userId,
    });
  },

  /**
   * Sadece Admin kullanıcıların push tokenlarını getirir
   */
  async getAdminPushTokens(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("push_token")
        .eq("role", "admin")
        .not("push_token", "is", null);

      if (error) {
        console.error("Error fetching admin push tokens:", error);
        return [];
      }

      return data
        .map((u) => u.push_token)
        .filter(
          (token): token is string =>
            Boolean(token && typeof token === "string" && token.trim().length > 0)
        );
    } catch (error) {
      console.error("Error in getAdminPushTokens:", error);
      return [];
    }
  },

  /**
   * Cihazı bildirimlere kaydeder ve bir token döndürür.
   */
  async registerForPushNotificationsAsync() {
    const { Platform } = require("react-native");
    const isAndroidExpoGo = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';

    if (isAndroidExpoGo) {
      console.log("Skipping push registration on Android Expo Go (Not supported on SDK 53+)");
      return null;
    }

    const Notifications = require("expo-notifications");

    let token;
    if (Platform.OS === 'android') {
      // HIGH importance channel — uygulama kapalıyken de banner gelsin
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        description: 'Sipariş ve menü bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      // iOS için tüm izin türleri açıkça isteniyor
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: false,
          allowProvisional: false,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Bildirim izni verilmedi (push token alınamayacak)');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        "de0c5b9d-8af0-44b2-8441-3be30b372aa0";

      if (!projectId) {
        console.warn("DİKKAT: ProjectId çekilemedi. Expo Push Token oluşturulamıyor.");
        return null;
      }

      // iOS için devicePushToken (APNs) yerine Expo Push Token kullanıyoruz
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
      console.log("Başarıyla alınan Push Token:", token);

      // iOS'ta badge sayacını sıfırla
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(0);
      }
    } catch (e) {
      console.error("Expo Push Token hatası:", e);
    }

    return token;
  },
};
