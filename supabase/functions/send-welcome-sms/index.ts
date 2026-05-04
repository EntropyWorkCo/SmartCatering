// supabase/functions/send-welcome-sms/index.ts
// Firma sahibi çalışan eklediğinde hoş geldin SMS'i gönderir (İletiMerkezi API)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, employeeName, companyId } = await req.json();

    if (!phone || !employeeName || !companyId) {
      return new Response(
        JSON.stringify({ error: "phone, employeeName ve companyId zorunludur." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Firma adını DB'den çek
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("company_name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error("Firma adı çekilemedi:", companyError);
    }

    const companyName = company?.company_name || "Firmanız";

    // SMS içeriği
    const messageText =
      `Sayın ${employeeName}, ${companyName} bünyesinde Meydan Lokanta sistemine kaydınız yapılmıştır. ` +
      `Uygulamayı indirip telefon numaranızla doğrudan 'Çalışan' sekmesinden giriş yapabilirsiniz.\n\n` +
      `iOS: https://apps.apple.com/app/smartcatering-entropymeydan/id6762192873\n` +
      `Android: https://play.google.com/store/apps/details?id=com.entropywork.smartcatering`;

    // İletiMerkezi SMS gönderimi (send-otp ile aynı altyapı)
    const apiKey = Deno.env.get("SMS_KEY") || "";
    const apiHash = Deno.env.get("SMS_HASH") || "";
    const sender = Deno.env.get("SMS_SENDER") || "MEYDAN";

    // Telefon numarasını temizle: son 10 rakamı al
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    if (!cleanPhone || cleanPhone.length !== 10) {
      console.error("Geçersiz telefon numarası:", phone);
      return new Response(
        JSON.stringify({ success: false, error: "Geçersiz telefon numarası." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = "https://api.iletimerkezi.com/v1/send-sms/json";
    const payload = {
      request: {
        authentication: { key: apiKey, hash: apiHash },
        order: {
          sender,
          iys: "0",
          message: {
            text: messageText,
            receipents: { number: [cleanPhone] },
          },
        },
      },
    };

    console.log(`Hoş geldin SMS'i gönderiliyor → ${cleanPhone} (${employeeName} / ${companyName})`);

    const smsResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const smsResult = await smsResponse.text();
    console.log("İletiMerkezi yanıtı:", smsResult);

    return new Response(
      JSON.stringify({ success: true, sent_to: cleanPhone }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-welcome-sms hatası:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
