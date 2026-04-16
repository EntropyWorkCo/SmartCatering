import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Initialize two clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ success: false, error: 'Telefon ve kod zorunludur' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Verify OTP using admin client (bypasses RLS)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: otpData, error: otpError } = await supabaseAdmin
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('is_used', false)
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (otpError || !otpData) {
        return new Response(JSON.stringify({ success: false, error: 'Geçersiz veya süresi dolmuş kod' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Mark code as used
    await supabaseAdmin
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', otpData.id);

    // 2. Normalize phone and check if user exists in public.users
    let basePhone = phone.replace(/[^0-9]/g, "");
    if (basePhone.startsWith("90") && basePhone.length > 10) basePhone = basePhone.slice(2);
    if (basePhone.startsWith("0")) basePhone = basePhone.slice(1);
    
    // Check all legacy formats
    const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("*")
        .or(`phone.eq."${basePhone}",phone.eq."0${basePhone}",phone.eq."+90${basePhone}"`)
        .limit(1)
        .single();

    if (!existingUser) {
        // User doesn't exist, tell frontend to register it
        return new Response(JSON.stringify({ success: true, user_exists: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. User exists -> Login and return tokens
    const effectivePhone = existingUser.phone; // Use whatever they saved
    const fakeEmail = `${effectivePhone}@meydan.com`;
    const staticPassword = `${effectivePhone}OtpPassword!`;

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: fakeEmail,
        password: staticPassword
    });

    if (authError || !authData.session) {
        return new Response(JSON.stringify({ success: false, error: 'Kullanıcı doğrulama hatası (session error)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ 
        success: true, 
        user_exists: true, 
        user: existingUser,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
