import Constants from "expo-constants";
import { supabase } from "../supabase";

const isExpoGo = Constants.appOwnership === 'expo';

export const notificationService = {
    /**
     * Admin'in tüm kullanıcılara veya spesifik bir listeye push bildirim göndermesini sağlar.
     */
    async sendPushNotification(
        tokens: string[],
        title: string,
        body: string,
        data?: any
    ) {
        if (!tokens || tokens.length === 0) return;
        // Remote push notifications are sent via Expo's backend API (fetch),
        // so this method is technically safe even in Expo Go for SENDING.
        // However, the client might not be able to RECEIVE them in Expo Go.
        try {
            const message = {
                to: tokens,
                sound: "default",
                title,
                body,
                data: data || {},
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
     * Belirli bir kullanıcının veya tüm kullanıcıların (admin için) push tokenlarını getirir
     */
    async getPushTokens(userId?: string, excludeAdmins: boolean = true): Promise<string[]> {
        try {
            let query = (supabase
                .from("users") as any)
                .select("push_token, admin")
                .not("push_token", "is", null);

            if (userId) {
                query = query.eq("id", userId);
            } else if (excludeAdmins) {
                // Varsayılan olarak admin olmayanların (müşterilerin) tokenlarını getir
                query = query.neq("admin", "true");
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
     * Kullanıcı sipariş verdikten belirli bir süre (örn. 15 dk) sonra yerel bildirim (local push) planlar.
     */
    async scheduleRatingNotification(minutesDelay: number = 15, orderId?: string) {
        const { Platform, Alert } = require("react-native");
        const title = "Yemeğiniz nasıldı? 🍽️";
        const body = "Bugünkü siparişinizi değerlendirerek bize yardımcı olmak ister misiniz?";
        const targetUrl = orderId ? `/(tabs)/order-rating?orderId=${orderId}` : "/(tabs)/past-orders";

        // Android Expo Go SDK 53+ restriction workaround: Simulate with Alert
        if (Platform.OS === "android" && isExpoGo) {
            console.log(`Simulating notification for ${minutesDelay} minutes later...`);

            // Simulate delay
            setTimeout(() => {
                Alert.alert(
                    title,
                    body,
                    [
                        { text: "Kapat", style: "cancel" },
                        {
                            text: "Değerlendir",
                            onPress: () => {
                                const { router } = require("expo-router");
                                router.push(targetUrl as any);
                            }
                        }
                    ]
                );
            }, minutesDelay * 60 * 1000);

            return;
        }

        try {
            const Notifications = require("expo-notifications");

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: { url: targetUrl },
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: minutesDelay * 60,
                    repeats: false,
                },
            });
            console.log(
                `Rating notification scheduled for ${minutesDelay} minutes later with target: ${targetUrl}`
            );
        } catch (error) {
            console.warn(
                "Rating bildirimi planlanamadı (Kritik olmayan hata):",
                error
            );
        }
    },

    /**
     * Sadece Admin kullanıcıların push tokenlarını getirir
     */
    async getAdminPushTokens(): Promise<string[]> {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("push_token")
                .eq("admin", "true")
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
        if (Platform.OS === 'android' && isExpoGo) {
            console.log("Skipping push registration on Android Expo Go (Restricted)");
            return null;
        }

        const Notifications = require("expo-notifications");

        let token;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                console.warn("DİKKAT: app.json içinde 'projectId' bulunamadı. Push bildirimleri (uygulama kapalıyken gelenler) çalışmayacaktır. Ancak uygulama içi uyarılar aktif kalacaktır.");
                return null;
            }
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log("Device Push Token:", token);
        } catch (e) {
            console.error("Error getting Expo Push Token:", e);
        }

        return token;
    },
};
