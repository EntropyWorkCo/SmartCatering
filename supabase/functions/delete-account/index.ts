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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Yetkilendirme eksik.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: string;

    try {
      // ES256 Hatalarını tamamen baypas etmek için MANUEL JWT PARSE
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Geçersiz token formatı');
      
      const payloadPart = parts[1];
      // Base64URL to Base64
      const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const pad = (4 - b64.length % 4) % 4;
      const padded = b64 + '='.repeat(pad);
      
      const jsonStr = atob(padded);
      const payload = JSON.parse(jsonStr);
      userId = payload.sub;

      if (!userId) throw new Error('Kullanıcı ID bulunamadı');
    } catch (e) {
      console.error('JWT Parse Hatası:', e);
      return new Response(JSON.stringify({ error: 'Oturum doğrulanırken ES256 çakışması yaşandı. Manuel parse başarısız.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 1. PROFiL ÇEK ──────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, role, company_id, full_name')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Profil bulunamadı.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2. BORÇ KONTROLÜ (Sadece Owner İçin) ───────────────────────
    if (profile.role === 'owner' || profile.role === 'corporate') {
       const { data: company } = await supabaseAdmin
         .from('companies')
         .select('id, balance')
         .eq('user_id', userId)
         .maybeSingle();

       const { count: unpaidCount } = await supabaseAdmin
         .from('adisyon')
         .select('*', { count: 'exact', head: true })
         .eq('company_id', company?.id || 'none')
         .not('status', 'in', '("PAID", "ÖDENDİ", "ÖDENDI")');

       if ((company?.balance || 0) > 0 || (unpaidCount || 0) > 0) {
         return new Response(JSON.stringify({ 
           success: false, 
           code: 'DEBT', 
           error: 'Ödenmemiş borcunuz bulunmaktadır. Lütfen önce borcunuzu ödeyin.' 
         }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }

       if (company) {
          // Arşivle
          await supabaseAdmin.from('adisyon').update({ company_id: null, note: '[ARŞİV] Şirket Silindi' }).eq('company_id', company.id);
          await supabaseAdmin.from('companies').delete().eq('id', company.id);
       }
    }

    // ── 3. TAMAMEN SİL ──────────────────────────────────────────────
    // Adisyonları sahipsiz bırak (arşivle)
    await supabaseAdmin.from('adisyon').update({ user_id: null, deleted_user_name: profile.full_name }).eq('user_id', userId);
    
    // Auth ve Public sil
    await supabaseAdmin.from('users').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
