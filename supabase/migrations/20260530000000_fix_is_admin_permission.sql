-- ============================================================
-- Fix: permission denied for function is_admin
-- Supabase'de is_admin() fonksiyonuna roller için EXECUTE yetkisi.
-- Bu migration 2026-05-30'da doğrudan db query ile uygulandı.
-- ============================================================

-- is_admin() fonksiyonuna yetki ver (idempotent — tekrar çalışması sorun çıkarmaz)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
