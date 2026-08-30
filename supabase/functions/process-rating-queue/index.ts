// supabase/functions/process-rating-queue/index.ts
//
// Amaç:
//   pg_cron tarafından her dakika tetiklenir.
//   pending_rating_notifications tablosundaki, zamanı gelmiş (scheduled_for <= now())
//   ve henüz gönderilmemiş (status = 'pending') kayıtları işler.
//
// Rol Filtresi:
//   Admin kullanıcılarına (role = 'admin') KESİNLİKLE bildirim GÖNDERİLMEZ.
//   "Şimdi Ye" işlemini kim yaparsa yapsın, admin ise kuyruk kaydı dahi oluşturulmamış
//   olmalı (adisyonService.ts tarafında filtre), fakat burada da çift güvenlik olarak
//   kontrol edilir.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ─────────────────────────────────────────────────────────────────────────────
// Expo Push API'ye bildirim gönderir (chunk: max 100 token/istek)
// ─────────────────────────────────────────────────────────────────────────────
async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const message = {
    to: token,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
    androidImportance: "max", // Android heads-up banner
  };

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[process-rating-queue] Expo Push API hatası: ${response.status} — ${errText}`);
  } else {
    const result = await response.json();
    console.log(`[process-rating-queue] Push gönderildi. Ticket:`, result?.data?.[0]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ana Handler
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (_req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // pg_cron OPTIONS isteği
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // service_role ile bağlan — RLS'yi bypass etmemiz gerekiyor
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Zamanı gelmiş, henüz gönderilmemiş kuyruk kayıtlarını çek ──
    //    users tablosuna JOIN yaparak rol ve push_token bilgisini de alıyoruz.
    const now = new Date().toISOString();

    const { data: dueItems, error: fetchError } = await supabase
      .from("pending_rating_notifications")
      .select(`
        id,
        order_id,
        user_id,
        users!pending_rating_notifications_user_id_fkey (
          push_token,
          role
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", now); // scheduled_for <= şu an

    if (fetchError) {
      console.error("[process-rating-queue] Kuyruk çekme hatası:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dueItems || dueItems.length === 0) {
      console.log("[process-rating-queue] Şu an gönderilecek bildirim yok.");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-rating-queue] ${dueItems.length} adet bildirim işlenecek.`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const item of dueItems) {
      const user = Array.isArray(item.users) ? item.users[0] : item.users;

      // ── 2. ADMIN FİLTRESİ ──────────────────────────────────────────────────
      // Admin rolündeki kullanıcılara değerlendirme bildirimi KESİNLİKLE gitmez.
      if (!user || user.role === "admin") {
        console.log(`[process-rating-queue] Kullanıcı ${item.user_id} admin veya bulunamadı — bildirim atlandı.`);

        // Kuyruğu "cancelled" olarak işaretle ki bir daha işlenmesin
        await supabase
          .from("pending_rating_notifications")
          .update({ status: "cancelled" })
          .eq("id", item.id);

        skippedCount++;
        continue;
      }

      // ── 3. Push token kontrolü ─────────────────────────────────────────────
      const pushToken: string | null = user.push_token ?? null;

      if (!pushToken || typeof pushToken !== "string" || !pushToken.trim()) {
        console.warn(`[process-rating-queue] Kullanıcı ${item.user_id} için push token yok — bildirim atlandı.`);

        await supabase
          .from("pending_rating_notifications")
          .update({ status: "cancelled" })
          .eq("id", item.id);

        skippedCount++;
        continue;
      }

      // ── 4. Push bildirimi gönder ───────────────────────────────────────────
      await sendExpoPush(
        pushToken,
        "Yemeğinizi değerlendirin 🍽️",
        "Bugünkü siparişinizi değerlendirerek bize yardımcı olmak ister misiniz?",
        {
          // expo-router deep link — tıklandığında değerlendirme sayfasına gider
          url: `/order-rating?orderId=${item.order_id}`,
          screen: "order-rating",
          orderId: item.order_id,
        }
      );

      // ── 5. Kuyruğu "sent" olarak güncelle ─────────────────────────────────
      await supabase
        .from("pending_rating_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      sentCount++;
    }

    console.log(`[process-rating-queue] Tamamlandı. Gönderilen: ${sentCount}, Atlanan: ${skippedCount}`);

    return new Response(
      JSON.stringify({ success: true, processed: dueItems.length, sent: sentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[process-rating-queue] Beklenmeyen hata:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
