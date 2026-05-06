import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client: service_role — OTP doğrulama, kullanıcı arama, generateLink için
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    // Anon client: verifyOtp için ŞART (service_role ile session'da user bilgisi olmaz)
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ success: false, error: 'Telefon ve kod zorunludur' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ADMIN MAGIC CODE BYPASS START ---
    const adminAccounts = ["admin@meydan.com"];
    const magicCodes = ["992288"]; // Daha güvenli 6 haneli kod
    let isMagicLogin = false;

    if (adminAccounts.includes(phone) && magicCodes.includes(code)) {
        console.log("🔐 Admin Güvenli Girişi:", phone);
        isMagicLogin = true;
    }
    // --- ADMIN MAGIC CODE BYPASS END ---

    // 1. Verify OTP using admin client (bypasses RLS)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    let { data: otpData, error: otpError } = isMagicLogin 
        ? { data: { id: 'magic', phone }, error: null } 
        : await supabaseAdmin
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

    // Mark code as used (skip for magic login)
    if (!isMagicLogin && otpData) {
        await supabaseAdmin
            .from('otp_codes')
            .update({ is_used: true })
            .eq('id', otpData.id);
    }

    // 2. Normalize phone and check if user exists in public.users
    let existingUser;
    if (phone === "admin@meydan.com") {
        // Test ve Ana Admin için sistemdeki herhangi bir admini alıyoruz
        const { data } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("role", "admin")
            .limit(1)
            .maybeSingle();
        existingUser = data;
    } else {
        let basePhone = phone.replace(/[^0-9]/g, "");
        if (basePhone.startsWith("90") && basePhone.length > 10) basePhone = basePhone.slice(2);
        if (basePhone.startsWith("0")) basePhone = basePhone.slice(1);
        
        const { data } = await supabaseAdmin
            .from("users")
            .select("*")
            .or(`phone.eq."${basePhone}",phone.eq."0${basePhone}",phone.eq."+90${basePhone}"`)
            .limit(1)
            .maybeSingle();
        existingUser = data;
    }

    if (!existingUser) {
        // User doesn't exist, tell frontend to register it
        return new Response(JSON.stringify({ success: true, user_exists: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Kullanıcı var → güvenli oturum aç
    const userId = existingUser.id;
    
    // auth.users'daki email formatı için basePhone'u mevcut kullanıcıdan türetmeliyiz
    let basePhone = existingUser.phone.replace(/[^0-9]/g, "");
    if (basePhone.startsWith("90") && basePhone.length > 10) basePhone = basePhone.slice(2);
    if (basePhone.startsWith("0")) basePhone = basePhone.slice(1);
    
    const authEmail = `${basePhone}@meydan.internal`;

    // 3a. auth.users kaydını kontrol et (çalışanlar public.users'a direkt eklenir,
    //     auth.users'da kaydı olmayabilir — ilk girişte oluşturuyoruz)
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (!authUserData?.user) {
        // auth.users kaydı yok → oluştur (aynı UUID ile, FK bozulmasın)
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            // @ts-ignore — id parametresi v2.39+ destekleniyor
            id: userId,
            email: authEmail,
            email_confirm: true,
            user_metadata: {
                full_name: existingUser.full_name,
                phone: existingUser.phone,
                role: existingUser.role,
            },
        });

        if (createError && !createError.message.includes('already exists')) {
            console.error('createUser error:', createError);
            return new Response(JSON.stringify({ success: false, error: 'Auth kaydı oluşturulamadı: ' + createError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
    } else if (authUserData.user.email !== authEmail) {
        // Email formatı eski sistemden farklı gelmiş olabilir — güncelle
        await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: authEmail,
            email_confirm: true,
        });
    }

    // 3b. Admin API ile tek kullanımlık token üret (hiçbir yere email gönderilmez)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: authEmail,
        options: { redirectTo: 'smartcatering://auth-callback' },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
        console.error('generateLink error:', linkError);
        return new Response(JSON.stringify({ success: false, error: 'Token üretilemedi: ' + linkError?.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3c. Token'ı ANON client ile exchange et → auth.uid() doğru olan gerçek session
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'email',
    });

    if (sessionError || !sessionData?.session) {
        console.error('verifyOtp error:', sessionError);
        return new Response(JSON.stringify({ success: false, error: 'Oturum doğrulanamadı: ' + sessionError?.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ 
        success: true, 
        user_exists: true, 
        user: existingUser,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
