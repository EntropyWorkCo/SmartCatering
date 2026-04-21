import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
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

    // --- APPLE REVIEW BYPASS ---
    const appleTestNumbers = ["+905051000000", "+905051000001", "+905551000001", "+905551000002", "apple-admin@smartcatering.com"];
    if (appleTestNumbers.includes(phone)) {
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, { 
        auth: { persistSession: false } 
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Veritabanı kaydı (Hata olsa bile devam et)
    try {
        await supabaseClient
          .from('otp_codes')
          .insert([{ phone, code: otpCode }]);
    } catch (e) { console.error("DB Error:", e); }

    const apiKey = Deno.env.get('SMS_KEY') || "";
    const apiHash = Deno.env.get('SMS_HASH') || "";
    const sender = Deno.env.get('SMS_SENDER') || "MEYDAN";

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

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(e => console.error("SMS Fetch Error:", e));

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
