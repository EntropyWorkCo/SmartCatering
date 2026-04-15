import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefon numarası eksik." }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Service Role Key kullanarak veritabanı kurucusu
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. 6 Haneli Rastgele Kod Üret
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Kodu veritabanına kaydet
    const { error: dbError } = await supabaseClient
      .from('otp_codes')
      .insert([{ phone, code: otpCode }]);

    if (dbError) {
      console.error("OTP Kayıt Hatası", dbError);
      return new Response(JSON.stringify({ error: "Veritabanına kayıt başarısız." }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. Çevre değişkenlerinden gizli API anahtarlarını oku
    const apiKey = Deno.env.get('SMS_KEY') || "";
    const apiHash = Deno.env.get('SMS_HASH') || "";
    const sender = Deno.env.get('SMS_SENDER') || "";

    if (!apiKey || !apiHash || !sender) {
      console.error("SMS API Bilgileri Eksik! Lütfen Supabase Secrets içerisine ekleyin.");
      return new Response(JSON.stringify({ error: "Sunucu SMS yapılandırma hatası." }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const messageText = `MeydanLokanta onay kodunuz: ${otpCode}. Lütfen kimseyle paylaşmayın.`;

    const apiUrl = "https://api.iletimerkezi.com/v1/send-sms/json";
    const payload = {
        request: {
            authentication: { key: apiKey, hash: apiHash },
            order: {
                sender: sender,
                iys: "0",
                message: { text: messageText, receipents: { number: [cleanPhone] } }
            }
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    const jsonData = JSON.parse(rawText);

    if (jsonData?.response?.status?.code == 200 || jsonData?.response?.status?.code === "200") {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    } else {
        console.error("Ileti Merkezi Hatası:", jsonData);
        return new Response(
          JSON.stringify({ error: "SMS Gateway Error", details: jsonData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
  } catch (error: any) {
    console.error("Beklenmeyen Hata:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
});
