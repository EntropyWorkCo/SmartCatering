// supabase/functions/scheduled-meal-reminder/index.ts
// ──────────────────────────────────────────────────────────────────────────────
// Sunucu taraflı zamanlanmış yemek hatırlatma bildirimi.
// Bir cron servisi (cron-job.org veya GitHub Actions) tarafından günde 2 kez çağrılır:
//   - 10:00 UTC (= 13:00 Türkiye) → Çalışanlara yemek yedin mi?
//   - 13:00 UTC (= 16:00 Türkiye) → Firma sahibine günlük özet
//
// Endpoint güvenliği: CRON_SECRET header ile korunur.
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Güvenlik: CRON_SECRET header kontrolü ──────────────────────────────────
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const incomingSecret = req.headers.get("x-cron-secret");
    if (incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Türkiye saatini hesapla (UTC+3) ───────────────────────────────────────
    const nowUTC = new Date();
    const nowTR = new Date(nowUTC.getTime() + 3 * 60 * 60 * 1000);
    const hourTR = nowTR.getUTCHours();
    const todayTR = nowTR.toISOString().split("T")[0]; // "YYYY-MM-DD"

    console.log(`[scheduled-meal-reminder] TR saati: ${hourTR}:00, Tarih: ${todayTR}`);

    // ── Hangi tip bildirim? ───────────────────────────────────────────────────
    const isReminderTime = hourTR >= 13 && hourTR < 15; // 13:00–15:00 TR
    const isSummaryTime  = hourTR >= 16 && hourTR < 20; // 16:00–20:00 TR

    if (!isReminderTime && !isSummaryTime) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "not_in_notification_window", hourTR }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Tüm firmaları çek ─────────────────────────────────────────────────────
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id, user_id");

    if (compErr) throw compErr;
    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_companies" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bugünün başlangıcı ve sonu (Türkiye saatiyle)
    const dateStart = new Date(`${todayTR}T00:00:00+03:00`).toISOString();
    const dateEnd   = new Date(`${todayTR}T23:59:59.999+03:00`).toISOString();

    let totalRemindersSent = 0;
    let totalSummariesSent = 0;

    for (const company of companies) {
      try {
        // ── Bu firmadaki tüm çalışanları çek ───────────────────────────────
        const { data: employees } = await supabase
          .from("users")
          .select("id, full_name, push_token")
          .eq("company_id", company.id)
          .not("role", "in", '("deleted","admin")')
          .not("push_token", "is", null);

        // Firma sahibini de çek
        const { data: ownerData } = await supabase
          .from("users")
          .select("id, full_name, push_token")
          .eq("id", company.user_id)
          .maybeSingle();

        const allPeople: any[] = [];
        if (ownerData?.id) allPeople.push(ownerData);
        for (const emp of employees || []) {
          if (!allPeople.find((p: any) => p.id === emp.id)) {
            allPeople.push(emp);
          }
        }

        if (allPeople.length === 0) continue;

        // ── Bugün sipariş verenler ──────────────────────────────────────────
        const allIds = allPeople.map((p: any) => p.id);
        const { data: todayOrders } = await supabase
          .from("adisyon")
          .select("user_id")
          .in("user_id", allIds)
          .gte("created_at", dateStart)
          .lte("created_at", dateEnd)
          .not("order_type", "in", '("MANUAL_DEBT","MANUAL_PAYMENT")')
          .not("status", "in", '("CANCELLED","İptal")');

        const doneIds = new Set((todayOrders || []).map((o: any) => o.user_id));

        // ── 13:00–15:00 → Çalışanlara hatırlatma ───────────────────────────
        if (isReminderTime) {
          const notDonePeople = allPeople.filter(
            (p: any) => !doneIds.has(p.id) && p.id !== company.user_id && p.push_token
          );

          if (notDonePeople.length > 0) {
            const tokens = notDonePeople.map((p: any) => p.push_token);
            await sendExpoNotifications(
              tokens,
              "🍽️ Bugün yemek yediniz mi?",
              "Bugün henüz yemek bildirimi yapmadınız. Sipariş vermek için uygulamayı açın.",
              { screen: "home" }
            );
            totalRemindersSent += notDonePeople.length;
            console.log(`[Firma ${company.id}] Hatırlatma → ${notDonePeople.length} kişi`);
          }
        }

        // ── 16:00–20:00 → Firma sahibine günlük özet ───────────────────────
        if (isSummaryTime && ownerData?.push_token) {
          const doneEmps = (employees || []).filter((e: any) => doneIds.has(e.id));
          const doneNames = doneEmps.map((e: any) => e.full_name?.split(" ")[0]).filter(Boolean);
          const empCount = (employees || []).length;

          const summaryBody = doneNames.length > 0
            ? `${doneNames.join(", ")} bugün yemek yedi. (${doneEmps.length}/${empCount} çalışan)`
            : `Bugün hiçbir çalışan yemek bildirimi yapmadı. (0/${empCount} çalışan)`;

          await sendExpoNotifications(
            [ownerData.push_token],
            "📊 Günlük Yemek Özeti",
            summaryBody,
            { screen: "corporate-info", tab: "KONTROL" }
          );
          totalSummariesSent++;
          console.log(`[Firma ${company.id}] Özet → firma sahibine gönderildi`);
        }
      } catch (companyErr) {
        console.error(`[Firma ${company.id}] hata:`, companyErr);
        // Bir firma hata verse bile diğerleri devam etsin
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hourTR,
        todayTR,
        totalRemindersSent,
        totalSummariesSent,
        companiesProcessed: companies.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[scheduled-meal-reminder] Kritik hata:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Expo Push API yardımcı fonksiyon ─────────────────────────────────────────
async function sendExpoNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
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
    console.error("Expo Push API hatası:", response.status, await response.text());
  } else {
    const result = await response.json();
    console.log(`Push gönderildi, ticket sayısı: ${result?.data?.length}`);
  }
}
