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
    async getPushTokens(userId?: string): Promise<string[]> {
        try {
            let query = supabase
                .from("users")
                .select("push_token")
                .not("push_token", "is", null);

            if (userId) {
                query = query.eq("id", userId);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching push tokens:", error);
                return [];
            }

            return data
                .map((user) => user.push_token)
                .filter(
                    (token): token is string =>
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
    async scheduleRatingNotification(minutesDelay: number = 15) {
        const { Platform, Alert } = require("react-native");
        const title = "Yemeğiniz nasıldı? 🍽️";
        const body = "Bugünkü siparişinizi değerlendirerek bize yardımcı olmak ister misiniz?";

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
                                router.push("/rating");
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
                    data: { url: "/rating" },
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: minutesDelay * 60,
                    repeats: false,
                },
            });
            console.log(
                `Rating notification scheduled for ${minutesDelay} minutes later.`
            );
        } catch (error) {
            console.warn(
                "Rating bildirimi planlanamadı (Kritik olmayan hata):",
                error
            );
        }
    },
};
