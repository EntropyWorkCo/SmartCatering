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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. JWT'den çağıran kullanıcıyı doğrula ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Yetkilendirme başlığı eksik.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kullanıcı kimliğini doğrula (token ile)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Geçersiz oturum.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = callerUser.id;

    // ── 2. Kullanıcı profilini çek ───────────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, company_id, is_company')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kullanıcı profili bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isCorporate = profile.is_company === true || profile.role === 'corporate' || profile.role === 'owner';
    const isEmployee = !isCorporate && !!profile.company_id;

    // ── 3A. BİREYSEL KULLANICI ───────────────────────────────────────────────
    if (!isCorporate && !isEmployee) {
      const { error: delUserError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (delUserError) throw delUserError;

      await supabaseAdmin.auth.admin.deleteUser(userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3B. ÇALIŞAN (company_id var ama firma sahibi değil) ──────────────────
    if (isEmployee) {
      const { error: unlinkError } = await supabaseAdmin
        .from('users')
        .update({ company_id: null, role: 'customer' } as any)
        .eq('id', userId);

      if (unlinkError) throw unlinkError;

      await supabaseAdmin.auth.admin.deleteUser(userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3C. FİRMA SAHİBİ ─────────────────────────────────────────────────────
    // 3C-1: Firmayı bul
    const { data: company, error: companyFetchError } = await supabaseAdmin
      .from('companies')
      .select('id, balance, company_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (companyFetchError) throw companyFetchError;

    // 3C-2: Borç kontrolü
    if (company && typeof company.balance === 'number' && company.balance > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DEBT',
          error: `Ödenmemiş ${company.balance.toLocaleString('tr-TR')} ₺ borcunuz bulunmaktadır. Lütfen önce borcunuzu kapatın.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3C-3: Aktif çalışanları soft-delete yap
    if (company) {
      const { error: softDelError } = await supabaseAdmin
        .from('users')
        .update({ role: 'deleted' } as any)
        .eq('company_id', company.id)
        .neq('role', 'deleted');

      if (softDelError) {
        console.error('Çalışan soft-delete hatası:', softDelError);
        // Non-fatal — devam et
      }
    }

    // 3C-4: Adisyon kayıtlarını arşivle (user_id = NULL, deleted_user_name = isim)
    const { error: archiveError } = await supabaseAdmin
      .from('adisyon')
      .update({
        user_id: null,
        deleted_user_name: profile.full_name ?? 'Silinmiş Kullanıcı',
      } as any)
      .eq('user_id', userId);

    if (archiveError) {
      console.error('Adisyon arşivleme hatası:', archiveError);
      // Non-fatal — devam et
    }

    // 3C-5: Şirketi sil
    if (company) {
      const { error: delCompanyError } = await supabaseAdmin
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (delCompanyError) throw delCompanyError;
    }

    // 3C-6: public.users kaydını sil
    const { error: delPublicUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (delPublicUserError) throw delPublicUserError;

    // 3C-7: auth.users'dan sil
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('delete-account beklenmeyen hata:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
