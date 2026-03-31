import { supabase } from "../supabase";

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
    }
};
