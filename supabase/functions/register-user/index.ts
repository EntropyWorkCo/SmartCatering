import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const {
      phone,       // Raw phone from user input
      name,        // Full name
      role,        // 'owner' | 'individual' | 'employee'
      companyName, // Only for owner
      vkn,         // Only for owner
      address,     // Only for individual
    } = await req.json();

    if (!phone || !name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: 'Eksik parametreler: phone, name, role zorunludur' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Normalize phone ───────────────────────────────────────────────────
    let basePhone = phone.replace(/[^0-9]/g, '');
    if (basePhone.startsWith('90') && basePhone.length > 10) basePhone = basePhone.slice(2);
    if (basePhone.startsWith('0')) basePhone = basePhone.slice(1);

    const effectivePhone = `+90${basePhone}`;
    const authEmail = `${basePhone}@meydan.internal`;
    const isCompany = role === 'owner';

    // ── 2. Check if user already exists in public.users ─────────────────────
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`phone.eq."${basePhone}",phone.eq."0${basePhone}",phone.eq."+90${basePhone}"`)
      .limit(1)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bu numara zaten kayıtlı. Lütfen giriş yapın.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Create the auth.users record via admin API ────────────────────────
    // email_confirm: true → no confirmation email needed (OTP already verified)
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        phone: effectivePhone,
        is_company: isCompany,
        role: role,
      },
    });

    if (createError || !newAuthUser?.user) {
      console.error('createUser error:', createError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kullanıcı oluşturulamadı: ' + createError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newAuthUser.user.id;

    // ── 4. Create public.users row ───────────────────────────────────────────
    // The trigger from auth.users → public.users may or may not exist.
    // Upsert to be safe in case the trigger already ran.
    const { error: publicUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        full_name: name,
        phone: effectivePhone,
        is_company: isCompany,
        role: role === 'owner' ? 'owner' : role === 'employee' ? 'employee' : 'customer',
        ...(address?.trim() && !isCompany ? { address } : {}),
      });

    if (publicUserError) {
      console.error('public.users insert error:', publicUserError);
      // Rollback auth user to keep state consistent
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ success: false, error: 'Profil oluşturulamadı: ' + publicUserError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Create companies row (if owner) ───────────────────────────────────
    if (isCompany && companyName) {
      const { error: companyError } = await supabaseAdmin
        .from('companies')
        .insert({
          user_id: userId,
          company_name: companyName,
          tax_number: vkn || null,
        });

      if (companyError) {
        console.error('companies insert error:', companyError);
        // Non-fatal — user can fill this in later
      }
    }

    // ── 6. Generate a magic-link token and exchange for a real session ───────
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
      options: { redirectTo: 'smartcatering://auth-callback' },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink error:', linkError);
      return new Response(
        JSON.stringify({ success: false, error: 'Oturum token\'ı üretilemedi. Lütfen giriş yapın.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    });

    if (sessionError || !sessionData?.session) {
      console.error('verifyOtp error:', sessionError);
      // Registration succeeded, but auto-login failed — tell client to navigate to login
      return new Response(
        JSON.stringify({ success: true, auto_login: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        auto_login: true,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
