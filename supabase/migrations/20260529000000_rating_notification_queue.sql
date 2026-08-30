-- ============================================================
-- Migration: Şimdi Ye → Değerlendirme Bildirim Kuyruğu
-- Amaç: Uygulama kapalı olsa da 15 dk sonra backend'den
--       değerlendirme bildirimi göndermek için kuyruk tablosu.
-- ============================================================

-- 1. Bildirim kuyruğu tablosu
CREATE TABLE IF NOT EXISTS public.pending_rating_notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id      UUID        NOT NULL REFERENCES public.adisyon(id) ON DELETE CASCADE,
  -- Bildirimin gönderilmesi gereken zaman (sipariş onayı + 15 dk)
  scheduled_for TIMESTAMPTZ NOT NULL,
  -- İşlem durumu: pending → sent | cancelled
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ
);

-- Zamanlayıcının hızlı tarama yapabilmesi için index
CREATE INDEX IF NOT EXISTS idx_pending_rating_notifications_scheduled
  ON public.pending_rating_notifications (scheduled_for)
  WHERE status = 'pending';

-- 2. pg_net extension'ı aktif et (Supabase'de varsayılan olarak gelir)
--    Zaten aktifse hata vermez.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. pg_cron extension'ı aktif et
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 4. Her dakika çalışan cron job: kuyruktaki zamanı gelmiş bildirimleri işle
--    (Önceki job varsa önce sil — migration tekrar çalışırsa çift kayıt oluşmasın)
SELECT cron.unschedule('process-rating-notification-queue')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-rating-notification-queue'
  );

-- ⚠️  Aşağıdaki <SERVICE_ROLE_KEY> kısmını doldurun:
--     Supabase Dashboard → Settings → API → service_role (secret key)
SELECT cron.schedule(
  'process-rating-notification-queue',   -- job adı
  '* * * * *',                           -- her dakika
  $$
  SELECT
    net.http_post(
      url     := 'https://vruwzmljqfvnerenwzpy.supabase.co/functions/v1/process-rating-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
