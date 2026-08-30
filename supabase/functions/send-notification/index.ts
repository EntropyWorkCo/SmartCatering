// supabase/functions/send-notification/index.ts
// Handles all push notification scenarios via Expo Push API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Supabase Edge Runtime global'i (background task desteği)
declare const EdgeRuntime: any;

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

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

// Geçersiz token'ları DB'den temizler (service role — RLS'e takılmaz)
async function cleanupDeadTokens(supabase: any, deadTokens: string[]) {
  if (deadTokens.length === 0) return;
  const { error } = await supabase
    .from("users")
    .update({ push_token: null })
    .in("push_token", deadTokens);
  if (error) {
    console.error("Dead token cleanup error:", error);
  } else {
    console.log(`Cleaned up ${deadTokens.length} dead push token(s).`);
  }
}

// Gönderir; ticket hatalarını anında işler, ticketId→token eşlemesini döndürür
async function sendExpoNotifications(
  supabase: any,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<Record<string, string>> {
  const ticketToToken: Record<string, string> = {};
  if (!tokens || tokens.length === 0) return ticketToToken;

  // Expo recommends chunking to max 100 per request
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    chunks.push(tokens.slice(i, i + 100));
  }

  const immediateDead: string[] = [];

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
      continue;
    }

    const result = await response.json();
    const tickets: any[] = result?.data ?? [];

    // Ticket'lar chunk'taki mesajlarla aynı sıradadır
    tickets.forEach((ticket, i) => {
      const token = chunk[i];
      if (ticket.status === "ok" && ticket.id) {
        ticketToToken[ticket.id] = token;
      } else if (ticket.status === "error") {
        console.error(
          `Ticket error for token ${token}: ${ticket.message} (${ticket.details?.error ?? "?"})`
        );
        if (ticket.details?.error === "DeviceNotRegistered") {
          immediateDead.push(token);
        }
      }
    });

    console.log(`Push chunk sent: ${tickets.length} ticket(s).`);
  }

  await cleanupDeadTokens(supabase, immediateDead);
  return ticketToToken;
}

// Receipt'leri kontrol eder: APNs/FCM reddi ancak burada görünür (ticket "ok" olsa bile)
async function checkReceiptsAndCleanup(
  supabase: any,
  ticketToToken: Record<string, string>
) {
  const ids = Object.keys(ticketToToken);
  if (ids.length === 0) return;

  // Receipt'lerin oluşması için bekle
  await new Promise((r) => setTimeout(r, 20000));

  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      console.error("Expo Receipts API Error:", response.status, await response.text());
      return;
    }

    const result = await response.json();
    const receipts: Record<string, any> = result?.data ?? {};
    const deadTokens: string[] = [];

    for (const [id, receipt] of Object.entries(receipts)) {
      if (receipt.status === "error") {
        const token = ticketToToken[id];
        console.error(
          `Receipt error for token ${token}: ${receipt.message} (${receipt.details?.error ?? "?"})`
        );
        if (receipt.details?.error === "DeviceNotRegistered" && token) {
          deadTokens.push(token);
        }
        // InvalidCredentials burada görünür → APNs key/credentials sorunu demektir
        if (receipt.details?.error === "InvalidCredentials") {
          console.error(
            "CRITICAL: InvalidCredentials — Expo'daki APNs/FCM credentials hatalı. 'eas credentials' ile kontrol edin."
          );
        }
      }
    }

    await cleanupDeadTokens(supabase, deadTokens);
    console.log(
      `Receipt check done: ${ids.length} checked, ${deadTokens.length} dead token(s) removed.`
    );
  } catch (e) {
    console.error("Receipt check failed:", e);
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
    const ticketToToken = await sendExpoNotifications(
      supabase,
      tokens,
      title,
      body,
      data
    );

    // Receipt kontrolünü yanıt döndükten sonra arka planda yap
    // (DeviceNotRegistered / InvalidCredentials ancak receipt'te görünür)
    const receiptCheck = checkReceiptsAndCleanup(supabase, ticketToToken);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(receiptCheck);
    } else {
      // Fallback: waitUntil yoksa beklemeden devam et
      receiptCheck.catch((e: any) => console.error("Receipt check error:", e));
    }

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
