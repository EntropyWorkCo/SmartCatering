// supabase/functions/send-notification/index.ts
// Handles all push notification scenarios via Expo Push API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotificationPayload {
  type: "NEW_ORDER" | "ORDER_STATUS" | "RATING_REQUEST" | "DAILY_MENU" | "MEAL_REMINDER";
  title: string;
  body: string;
  data?: Record<string, any>;
  // For targeted notifications
  userId?: string;
  // For multiple targeted users
  userIds?: string[];
  // For admin-only notifications
  adminOnly?: boolean;
  // For broadcast (all users)
  broadcast?: boolean;
}

async function sendExpoNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!tokens || tokens.length === 0) return;

  // Expo recommends chunking to max 100 per request
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    chunks.push(tokens.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const messages = chunk.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
      channelId: "default",
      // Android high-priority heads-up notification
      androidImportance: "max",
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        "Expo Push API Error:",
        response.status,
        await response.text()
      );
    } else {
      const result = await response.json();
      console.log("Push sent successfully, tickets:", result?.data?.length);
    }
  }
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload & { excludeUserId?: string } = await req.json();
    const { type, title, body, data = {}, userId, userIds, adminOnly, broadcast, excludeUserId } = payload;

    let tokens: string[] = [];

    if (userIds && userIds.length > 0) {
      // Birden fazla belirli kullanıcıya gönder
      let query = supabase
        .from("users")
        .select("push_token")
        .in("id", userIds)
        .not("push_token", "is", null);

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data: users, error } = await query;
      if (error) throw error;
      tokens = (users || [])
        .map((u: any) => u.push_token)
        .filter((t: any): t is string => Boolean(t && t.trim()));
    } else if (adminOnly) {
      // Fetch admin tokens only
      let query = supabase
        .from("users")
        .select("push_token")
        .eq("role", "admin")
        .not("push_token", "is", null);

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data: admins, error } = await query;

      if (error) throw error;
      tokens = (admins || [])
        .map((u: any) => u.push_token)
        .filter((t: any): t is string => Boolean(t && t.trim()));
    } else if (userId) {
      // Fetch a specific user's token
      if (userId === excludeUserId) {
        tokens = [];
      } else {
        const { data: user, error } = await supabase
          .from("users")
          .select("push_token, role")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;
        if (user?.push_token) tokens = [user.push_token];
      }
    } else if (broadcast) {
      // Fetch ALL user tokens (including admins — daily menu goes to everyone)
      const { data: allUsers, error } = await supabase
        .from("users")
        .select("push_token")
        .not("push_token", "is", null);

      if (error) throw error;
      tokens = (allUsers || [])
        .map((u: any) => u.push_token)
        .filter((t: any): t is string => Boolean(t && t.trim()));
    }

    if (tokens.length === 0) {
      console.log(`No tokens found for type=${type}. Skipping.`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no_tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Sending [${type}] notification to ${tokens.length} device(s)...`
    );
    await sendExpoNotifications(tokens, title, body, data);

    return new Response(
      JSON.stringify({ success: true, sent: tokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-notification Edge Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
