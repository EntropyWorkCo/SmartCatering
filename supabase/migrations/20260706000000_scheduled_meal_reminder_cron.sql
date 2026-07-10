-- ============================================================
-- Migration: Otomatik Yemek Hatırlatma / Günlük Özet Zamanlayıcısı
-- Amaç: scheduled-meal-reminder edge function'ını uygulama kapalıyken de
--       sunucudan sabit saatlerde otomatik çalıştırmak.
--
--   • 10:00 UTC = 13:00 Türkiye → Yemek bildirimi yapmayan çalışanlara hatırlatma
--   • 13:00 UTC = 16:00 Türkiye → Firma sahibine günlük yemek özeti
--
-- NOT: Yeni tablo/kolon YOK. Sadece pg_cron zamanlaması ekleniyor.
--      (pg_cron + pg_net zaten projede aktif — rating kuyruğu için kullanılıyor.)
--      Türkiye kalıcı UTC+3 (yaz saati uygulanmıyor), bu yüzden saatler sabit.
-- ============================================================

-- Ekstansiyonlar zaten aktif olabilir; tekrar çalışırsa hata vermez.
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ─────────────────────────────────────────────────────────────
-- Önceki job'lar varsa temizle (migration tekrar çalışırsa çift kayıt olmasın)
-- ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('meal-reminder-employees')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meal-reminder-employees');

SELECT cron.unschedule('meal-summary-owner')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meal-summary-owner');

-- ⚠️  Güvenlik: Fonksiyon herkese açık olmasın diye CRON_SECRET ile korunur.
--     1) Bir secret üret:            openssl rand -hex 32
--     2) Fonksiyona tanımla:         supabase secrets set CRON_SECRET=<DEGER>
--     3) Aşağıdaki iki <CRON_SECRET> kısmına AYNI değeri yaz.
--     Fonksiyon, x-cron-secret header'ı eşleşmezse 401 döner. verify_jwt=false
--     olduğundan Authorization/service_role anahtarına gerek yoktur.

-- ── 1) 13:00 TR → Yemek yapmayan çalışanlara hatırlatma ──────
SELECT cron.schedule(
  'meal-reminder-employees',   -- job adı
  '0 10 * * *',                -- her gün 10:00 UTC = 13:00 TR
  $$
  SELECT
    net.http_post(
      url     := 'https://vruwzmljqfvnerenwzpy.supabase.co/functions/v1/scheduled-meal-reminder',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- ── 2) 16:00 TR → Firma sahibine günlük özet ─────────────────
SELECT cron.schedule(
  'meal-summary-owner',        -- job adı
  '0 13 * * *',                -- her gün 13:00 UTC = 16:00 TR
  $$
  SELECT
    net.http_post(
      url     := 'https://vruwzmljqfvnerenwzpy.supabase.co/functions/v1/scheduled-meal-reminder',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- ============================================================
-- Saati değiştirmek istersen (Seçenek A — sabit saat):
--   Sadece yukarıdaki cron ifadelerini güncelle. Örn. 12:00 TR hatırlatma için
--   '0 9 * * *' (09:00 UTC). Fonksiyon içindeki saat penceresi 13–15 / 16–20
--   olduğundan, farklı saat isteniyorsa scheduled-meal-reminder/index.ts
--   içindeki isReminderTime / isSummaryTime aralıkları da buna göre ayarlanmalı.
--
-- Kurulumu kontrol etmek için:
--   SELECT jobname, schedule, active FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ============================================================
