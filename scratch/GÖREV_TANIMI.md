# SmartCatering — Geliştirme Görev Tanımı

---

## PROJE BAĞLAMI

React Native / Expo uygulaması. Backend: Supabase (PostgreSQL + Edge Functions + Expo Push Notifications).

**Kullanıcı Rolleri:**
- `firma_sahibi` → Şirket sahibi. Hem yemek yer (Şimdi Ye yapabilir) hem çalışanlarını yönetir.
- `calisan` → Şirkete bağlı çalışan. Şimdi Ye yapabilir.
- `bireysel` → Bağımsız kullanıcı. Şimdi Ye yapabilir.
- `admin` → Sadece sipariş/borç yönetimi yapar. **Yemek YEMEZ. Hiçbir şekilde değerlendirme bildirimi almaz.**

**Kritik kural:** `admin` rolü hangi işlemi yaparsa yapsın, değerlendirme bildirimi kuyruğuna (`pending_rating_notifications`) **asla** eklenmez.

**Veritabanı güvenliği:** Aşağıdaki geliştirmelerin hiçbirinde mevcut tablolardan veri silinmeyecek. Yeni tablo/sütun eklenebilir, mevcut veriler dokunulmaz kalacak.

---

## GÖREV 1 — Firma Sahibi: Çalışan Yemek Takip Ekranı

### İstenen Davranış
Firma sahibi, kendi şirketine bağlı çalışanların o gün "Şimdi Ye" işlemi yapıp yapmadığını görebilmeli.

### Ekran Detayları
- **Konum:** Mevcut `corporate-info.tsx` ekranına yeni bir sekme/bölüm olarak eklenmeli. Tab adı: `YEMEK TAKİP`
- **Filtre:** Sadece bugünün (`created_at::date = CURRENT_DATE`) "Şimdi Ye" siparişleri (`order_type = 'Şimdi Ye'`) sayılacak.
- **Liste içeriği:**
  - Çalışan adı
  - Yaptı ✅ / Yapmadı ❌ durumu
  - Yaptıysa saat bilgisi (ör: "12:34'te yaptı")
- **Borç bağımsızlığı:** Bu liste borç durumundan bağımsız. Borçlu olsa da yemek yaptıysa "Yaptı" görünmeli.

### Supabase Sorgusu (referans)
```sql
-- Şirkete bağlı tüm çalışanlar + bugün Şimdi Ye yapıp yapmadıkları
SELECT
  u.id,
  u.full_name,
  MAX(a.created_at) AS last_order_at,
  COUNT(a.id) > 0 AS has_eaten_today
FROM users u
LEFT JOIN adisyon a
  ON a.user_id = u.id
  AND a.order_type = 'Şimdi Ye'
  AND a.created_at::date = CURRENT_DATE
  AND a.status NOT IN ('CANCELLED', 'İptal')
WHERE u.company_id = '<company_id>'
   OR u.id = '<owner_user_id>'  -- firma sahibinin kendisi de dahil
GROUP BY u.id, u.full_name
ORDER BY has_eaten_today DESC, u.full_name ASC;
```

### Bildirim — "Yemek Hatırlatma"
Firma sahibi bu ekrandan manuel olarak çalışanlarına bildirim gönderebilmeli.

- **Buton:** "Yemek Hatırlatması Gönder" (sadece henüz Şimdi Ye yapmamış çalışanlara gönderir)
- **Bildirim içeriği:**
  - Başlık: `"Yemek Hatırlatması 🍽️"`
  - Mesaj: `"Bugün henüz yemek bildirimi yapmadınız. Unutmayın!"`
  - Deep link: `data: { url: '/(tabs)/home', screen: 'home' }`
- **Gönderim:** `notificationService.sendViaEdgeFunction({ type: 'MEAL_REMINDER', userIds: [...yapmayanlarin_id_listesi] })` ile

### Gün Sonu Otomatik Özet Bildirimi (Opsiyonel / İkinci Aşama)
Her gün saat **14:00**'da firma sahibine otomatik özet gitmeli (pg_cron ile):
- Başlık: `"Günlük Yemek Özeti 📊"`
- Mesaj: `"Bugün X/Y çalışan yemek bildirimi yaptı."`
- Bu bildirim sadece firma sahibine gider, çalışanlara gitmez.

---

## GÖREV 2 — "Şimdi Ye" Değerlendirme Bildirimi Düzeltmeleri

### Mevcut Durum
`adisyonService.ts` içinde "Şimdi Ye" bloğu şu an backend kuyruğa (`pending_rating_notifications`) ekliyor. 15 dakika sonra `process-rating-queue` edge function Expo Push API'ye gönderiyor.

### Sorun 1 — Firma Sahibi Bildirimi Gelmiyor
`adisyonService.createOrder` içinde firma sahibi rolü kontrol edilmiyor. Firma sahibi kendi siparişini verdiğinde kuyruğa eklenmiyor olabilir. Aşağıdaki kontrol eklendiğinden emin ol:

```typescript
// adisyonService.ts — Şimdi Ye bloğu içinde
const { data: userRoleData } = await supabase
  .from("users")
  .select("role")
  .eq("id", userId)
  .maybeSingle();

// admin DEĞİLSE kuyruğa ekle (firma_sahibi, calisan, bireysel → hepsi eklenebilir)
if (userRoleData?.role !== "admin") {
  const scheduledFor = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from("pending_rating_notifications").insert({
    user_id: userId,
    order_id: adisyon.id,
    scheduled_for: scheduledFor,
    status: "pending",
  });
}
```

### Sorun 2 — iOS Push Bildirimi Düşmüyor

Bu sorunun birden fazla sebebi olabilir. Aşağıdakilerin **tamamını** kontrol et ve uygula:

#### 2a. `app.json` — `notification` bölümü eksik
`app.json` içinde `expo.notification` objesi boş (`{}`). Şu şekilde doldur:
```json
"notification": {
  "icon": "./assets/images/icon.png",
  "color": "#f59e0b",
  "iosDisplayInForeground": true
}
```

#### 2b. APNs — Production vs Development ortamı
`expo-notifications` plugin'inde `"mode": "production"` var. Bu, **production sertifikası** ile imzalanmış build gerektirir.

- **Simulator'da test ediyorsan:** Push bildirim çalışmaz, fiziksel cihaz lazım.
- **TestFlight veya App Store build'i değilse:** `"mode": "development"` olarak değiştir, yeniden build al.
- **EAS build kullanıyorsan:** `eas build --profile development --platform ios` ile development build al.

Kontrol: `app.json` içinde:
```json
["expo-notifications", {
  "icon": "./assets/images/icon.png",
  "color": "#f59e0b",
  "defaultChannel": "default",
  "mode": "development"  // ← TestFlight/App Store değilse bunu kullan
}]
```

#### 2c. `GoogleService-Info.plist` doğru yerde mi?
`app.json` içinde:
```json
"ios": {
  "googleServicesFile": "./GoogleService-Info.plist"
}
```
Bu dosyanın proje kökünde olduğunu doğrula: `ls GoogleService-Info.plist`

#### 2d. Expo Push Token alınıyor mu?
`notificationService.registerForPushNotificationsAsync()` sonucu `users` tablosundaki `push_token` sütununa yazılıyor mu? Supabase Dashboard → Table Editor → `users` → `push_token` sütununu kontrol et. iOS cihaz için değer olmalı ve `ExpoToken[...]` formatında başlamalı.

#### 2e. Edge Function Authorization — access_token null sorunu
`notificationService.sendViaEdgeFunction` içinde `access_token` null gelirse `Bearer null` gönderiliyor, Supabase bunu log'a bile almadan reddediyor. **Bu düzeltme yapıldı** (anon key fallback eklendi). Dosyanın şu şekilde olduğundan emin ol:

```typescript
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const token = sessionData?.session?.access_token ?? ANON_KEY;
```

#### 2f. `send-notification` Edge Function — iOS token kontrolü
Edge function içinde token `ExpoToken[...]` formatında mı geliyor? Bazı durumlarda APNs device token (`device_push_token`) ile Expo push token karışıyor. `registerForPushNotificationsAsync` içinde mutlaka `getExpoPushTokenAsync` kullanılıyor olmalı, `getDevicePushTokenAsync` değil.

```typescript
// DOĞRU:
const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
// YANLIŞ (bu APNs raw token'ı döndürür, Expo Push API'ye gitmez):
// const tokenData = await Notifications.getDevicePushTokenAsync();
```

#### 2g. Test Etme Adımları
1. Fiziksel iOS cihazda uygulamayı aç
2. Supabase Dashboard → Table Editor → `users` → kendi kullanıcının `push_token` değerini kontrol et (`ExpoToken[...]` ile başlamalı)
3. "Şimdi Ye" ile sipariş ver
4. Supabase Dashboard → Table Editor → `pending_rating_notifications` → yeni kayıt oluştu mu?
5. Supabase Dashboard → Edge Functions → `send-notification` → Logs → 15 dakika sonra log düşüyor mu?

---

## GÖREV 3 — Admin: Ay Kapanışı / Borç Onay Sistemi

### İstenen Davranış
Admin, ay sonunda tüm kurumsal borçları toplu olarak onaylayabilmeli (kapatabilmeli).

### Ekran: Ay Kapanışı Paneli
- **Konum:** `(admin)/ekstre-list.tsx` ekranına yeni bir buton/section ekle: "Ay Kapanışı"
- **İşlev:** Seçilen ay için tüm PENDING ve UNPAID siparişleri PAID/kapalı olarak işaretler.

### Akış
1. Admin "Ay Kapanışı" butonuna basar
2. Hangi ay/yıl kapanacağını seçer (DatePicker ile, default: önceki ay)
3. **Özet ekranı gösterilir** (onay öncesi):
   - Kaç firma etkilenecek
   - Toplam borç tutarı
   - Kaç sipariş kapatılacak
4. Admin "Onayla ve Kapat" der
5. İşlem gerçekleşir, admin'e özet bildirim gider

### Supabase Sorgusu (referans)
```sql
-- Belirtilen ay için kapanacak siparişler
UPDATE adisyon
SET
  status = 'PAID',
  paid_at = NOW()
WHERE
  DATE_TRUNC('month', created_at) = DATE_TRUNC('month', '<seçilen_ay>'::date)
  AND status NOT IN ('PAID', 'Ödendi', 'CANCELLED', 'İptal', 'COMPLETED', 'Tamamlandı')
  AND order_type NOT IN ('MANUAL_PAYMENT');  -- manuel ödemelere dokunma
```

### TypeScript Fonksiyonu (`billingService.ts`'e eklenecek)
```typescript
async closeMonth(year: number, month: number): Promise<{ affectedOrders: number; totalAmount: number }> {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  // 1. Özet hesapla
  const { data: summary } = await supabase
    .from("adisyon")
    .select("id, total_amount")
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .not("status", "in", '("PAID","Ödendi","CANCELLED","İptal","COMPLETED","Tamamlandı")')
    .neq("order_type", "MANUAL_PAYMENT");

  // 2. Kapat
  const { error } = await supabase
    .from("adisyon")
    .update({ status: "PAID", paid_at: new Date().toISOString() })
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .not("status", "in", '("PAID","Ödendi","CANCELLED","İptal","COMPLETED","Tamamlandı")')
    .neq("order_type", "MANUAL_PAYMENT");

  if (error) throw error;

  return {
    affectedOrders: summary?.length ?? 0,
    totalAmount: summary?.reduce((sum, o) => sum + (o.total_amount || 0), 0) ?? 0,
  };
}
```

### Güvenlik
- Bu endpoint sadece `role === 'admin'` kullanıcı tarafından çağrılabilir.
- İşlem geri alınamaz olduğu için onay modal'ı **zorunlu**.
- Silme yok — sadece `status` güncelleniyor, veriler korunuyor.

---

## ÖZET KONTROL LİSTESİ

| # | Görev | Dosya(lar) | Öncelik |
|---|-------|-----------|---------|
| 1 | Çalışan yemek takip ekranı | `app/corporate-info.tsx` | Yüksek |
| 2 | Manuel yemek hatırlatma bildirimi | `corporate-info.tsx` + `notificationService.ts` | Yüksek |
| 3 | Firma sahibi Şimdi Ye → 15dk bildirim fix | `adisyonService.ts` | Yüksek |
| 4 | iOS push bildirimi fix (app.json + APNs mode) | `app.json` | Kritik |
| 5 | access_token null → anon key fallback | `notificationService.ts` | Kritik (yapıldı) |
| 6 | Ay kapanışı / borç onay ekranı | `app/(admin)/ekstre-list.tsx` + `billingService.ts` | Orta |

---

## KRİTİK KURALLAR (Tüm Geliştirmeler İçin)

1. **Veri silinmez.** Hiçbir `DELETE` sorgusu yazılmaz. Sadece `INSERT`, `UPDATE`, `SELECT`.
2. **Admin değerlendirme bildirimi almaz.** `role === 'admin'` kontrolü her bildirim gönderim noktasında bulunmalı.
3. **Modüler yapı korunur.** Servis fonksiyonları `lib/services/` altında kalır, UI'a iş mantığı karıştırılmaz.
4. **Mevcut bildirim altyapısı kullanılır.** Yeni bildirimler için `notificationService.sendViaEdgeFunction()` çağrılır, doğrudan Expo Push API'ye gidilmez.
