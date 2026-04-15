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
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "Telefon numarası ve kod eksik." }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // En son geçerli olan kodu çek (kullanılmamış ve 5 dakika içinde üretilmiş)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabaseClient
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('is_used', false)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error("Kod geçersiz veya süresi dolmuş:", error?.message || "Kayıt bulunamadı");
      return new Response(JSON.stringify({ success: false, error: "Girdiğiniz kod yanlış veya süresi dolmuş." }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Kodu kullanıldı olarak işaretle
    const { error: updateError } = await supabaseClient
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', data.id);

    if (updateError) {
        console.error("Kod kullanıldı olarak işaretlenemedi:", updateError.message);
        return new Response(JSON.stringify({ error: "Sunucu hatası: Kod doğrulanamadı." }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
    
  } catch (error: any) {
    console.error("Beklenmeyen Hata:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
});
