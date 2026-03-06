# Smart Catering 🍽️ - Full Stack Catering Management System

Smart Catering, modern lokanta ve yemek üretim tesisleri için geliştirilmiş, **Expo (React Native)** ve **Supabase** tabanlı kapsamlı bir işletme yönetim çözümüdür. Hem müşteri hem de admin (işletme sahibi) tarafını kapsayan bu full-stack uygulama; sipariş yönetiminden borç takibine, menü planlamasından gelişmiş raporlamaya kadar tüm süreçleri dijitalleştirir.

---

## 🚀 Öne Çıkan Özellikler

### 👑 Admin Paneli (İşletme Yönetimi)
*   **4-Sekmeli Gelişmiş Menü Yönetimi:**
    *   **Yemek Ekle:** Dinamik satır ekleme özelliğiyle (Bulk Add) saniyeler içinde onlarca yemek girişi. Akıllı kategori ve fiyat tahminleme ile hızlı veri girişi.
    *   **Yemek Havuzu:** İşletmenin tüm yemek katalogunun tutulduğu kalıcı bir veri bankası. Yemekleri silmeden aktif/pasif yapabilme.
    *   **Günün Menüsü:** Havuzdan seçilen yemeklerin saniyeler içinde yayına alınması. "Tükendi" durumu yönetimi ve anlık müşteri bilgilendirmesi.
    *   **Sabit Fiyat Listesi:** Tabela fiyatlarının sistem genelinde senkronize yönetilmesi.
*   **Finansal Takip & Borç Yönetimi:** Müşteri bazlı borç takibi, kurumsal/bireysel gruplandırma ve tek tıkla tahsilat onayı.
*   **Gelişmiş Raporlama:** Günlük, haftalık ve aylık ciro analizleri. Puan ortalamaları (Rating) üzerinden performans takibi.
*   **PDF Dökümü:** Satış raporlarının ve müşteri borç detaylarının şık bir A4 formatında PDF olarak kaydedilmesi ve paylaşılması (`expo-print`).

### 📱 Müşteri Uygulaması
*   **Hızlı Sipariş:** Tabldot paket (3 çeşit, 4 çeşit vb.) veya tek ürün üzerinden kolay sipariş akışı.
*   **Sipariş Notları:** "Bol acılı olsun", "Zile basmayın" gibi özel notların iletilmesi.
*   **Profil Yönetimi:** Kişiselleştirilmiş profil fotoğrafı ve bildirim ayarları.
*   **Değerlendirme Sistemi:** Siparişten 15 dakika sonra gelen otomatik bildirimle yemekleri puanlama ve geri bildirim bırakma.
*   **Borç Detayları:** Ödenmemiş siparişlerin dökümünü anlık görme ve PDF olarak indirme.

---

## 🛠️ Teknoloji Yığını

*   **Frontend:** React Native (Expo SDK 54+)
*   **Backend & DB:** Supabase (PostgreSQL)
*   **Kimlik Doğrulama:** Supabase Auth
*   **Dosya Depolama:** Supabase Storage (Yemek resimleri)
*   **State Management:** Zustand (Cart & Theme Store)
*   **Bildirimler:** Expo Notifications (Local & Remote Push)
*   **Raporlama:** Expo Print & Expo Sharing
*   **Styling:** Custom Theme Engine (Dark/Light Mode)
*   **Dil:** TypeScript

---

## 📦 Kurulum ve Çalıştırma

### Gereksinimler
*   Node.js (v18+)
*   Expo Go (Mobil test için) veya Android/iOS Simülatörü

### Adımlar
1.  **Projeyi Klonlayın:**
    ```bash
    git clone https://github.com/EntropyWorkCo/SmartCatering.git
    cd SmartCatering
    ```
2.  **Bağımlılıkları Kurun:**
    ```bash
    npm install
    ```
3.  **Çevresel Değişkenleri Ayarlayın:**
    Root dizininde bir `.env` dosyası oluşturun ve Supabase bilgilerinizi ekleyin:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Uygulamayı Başlatın:**
    ```bash
    npx expo start
    ```

---

## 📂 Klasör Yapısı

```
├── app/               # Expo Router dosya tabanlı yönlendirme
│   ├── (admin)/       # İşletme yönetim sayfaları
│   ├── (tabs)/        # Müşteri ana menü sekmeleri
│   └── (auth)/        # Giriş / Kayıt ekranları
├── components/        # Yeniden kullanılabilir UI bileşenleri
├── constants/         # Tema ve Renk paletleri
├── lib/               # Servisler, Hooklar ve Storelar
│   ├── services/      # Supabase (API) entegrasyonları
│   ├── hooks/         # Özel React Hookları
│   └── store/         # Zustand State Management
└── supabase/          # Veritabanı şema ve policy dosyaları
```

---

## 🔄 Son Güncellemeler (V1.1)
*   **Menü Altyapısı Yenilendi:** Tüm menü süreci "Havuz" mantığına taşındı, kargaşa giderildi.
*   **Otomatik Bildirim Motoru:** Sipariş sonrası 15. dakikada çalışan değerlendirme bildirimi eklendi (Expo Go fallback destekli).
*   **Admin UX:** Toplu yemek ekleme ve sadeleştirilmiş dashboard tasarımı devreye alındı.
*   **Hata Giderimleri:** Android Expo Go (SDK 53) üzerindeki bildirim kütüphanesi çakışmaları giderildi.

---

## 📄 Lisans
Bu proje **Entropy Work Co.** bünyesinde geliştirilmiştir. Tüm hakları saklıdır.

---
*Developed with ❤️ by Antigravity*
