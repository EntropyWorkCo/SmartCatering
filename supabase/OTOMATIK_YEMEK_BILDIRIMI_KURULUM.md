# Otomatik Yemek Hatırlatma — Kurulum Adımları

Bu değişiklik, mevcut `scheduled-meal-reminder` edge function'ını **sabit saatlerde
otomatik** çalıştırır. Uygulama açık olsun olmasın bildirimler sunucudan gider.

- **13:00 (TR)** → Yemek bildirimi yapmayan çalışanlara "Bugün yemek yediniz mi?" hatırlatması
- **16:00 (TR)** → Firma sahibine günlük özet ("kim yedi / kaç kişi yemedi")

> Yeni tablo/kolon eklenmedi. Sadece zaten aktif olan `pg_cron` ile iki zamanlama eklendi.

---

## Yapılan kod değişiklikleri (bende hazır)

1. `supabase/migrations/20260706000000_scheduled_meal_reminder_cron.sql` — iki cron job.
2. `supabase/config.toml` — `scheduled-meal-reminder` fonksiyonu tanımlandı.
3. `app/corporate-info.tsx` — istemci taraflı otomatik gönderim devre dışı (çift bildirim
   olmasın). Manuel "gönder" butonu aynen çalışıyor.

## Senin yapman gereken 2 adım (Supabase erişimi gerekir)

### 1) Fonksiyonu deploy et
```bash
supabase functions deploy scheduled-meal-reminder
```

### 2) Cron'u kur
Migration'daki **`<SERVICE_ROLE_KEY>`** (2 yerde) kısmını gerçek service_role anahtarıyla
değiştir (Dashboard → Settings → API → service_role), sonra:
```bash
supabase db push
```
veya migration SQL'ini Supabase Studio → SQL Editor'a yapıştırıp çalıştır
(rating kuyruğunu kurarken yaptığın gibi).

> Not: `CRON_SECRET` **gerekmiyor** — çağrı service_role JWT ile yetkileniyor.

## Kurulumu doğrula
```sql
SELECT jobname, schedule, active FROM cron.job;
-- meal-reminder-employees | 0 10 * * * | t
-- meal-summary-owner      | 0 13 * * * | t

SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Saati değiştirmek istersen (Seçenek A — sabit saat)
Migration'daki cron ifadelerini güncelle (UTC yazılır, TR = UTC+3):
- `0 10 * * *` = 13:00 TR, `0 11 * * *` = 14:00 TR, vb.
- Fonksiyon içindeki pencere 13–15 / 16–20 olduğundan çok farklı bir saat istersen
  `scheduled-meal-reminder/index.ts` içindeki `isReminderTime` / `isSummaryTime`
  aralıklarını da güncelle.

---

## Statik doğrulama (kod incelemesiyle)

- **Saat/zaman dilimi:** Fonksiyon UTC+3 sabit kullanıyor; Türkiye yaz saati uygulamadığı
  için doğru. 10:00 UTC → 13:00 TR, 13:00 UTC → 16:00 TR.
- **Çift gönderim yok:** Cron her işi günde 1 kez tetikliyor; 10:00 UTC çağrısı yalnız
  hatırlatma penceresine, 13:00 UTC çağrısı yalnız özet penceresine düşüyor.
- **Firma sahibi hariç:** Hatırlatma çalışanlara gidiyor, özet yalnız firma sahibine.
- **İptal/manuel kayıtlar:** `CANCELLED/İptal` ve `MANUAL_DEBT/MANUAL_PAYMENT` siparişler
  "yedi" sayılmıyor.

> Canlı doğrulama (bildirimin gerçekten telefona düşmesi) ancak deploy sonrası, gerçek
> push token'lı bir cihazla test edilerek kesinleşir. İstersen cron saatini geçici olarak
> birkaç dakika sonrasına alıp tek seferlik deneyebilirsin.
