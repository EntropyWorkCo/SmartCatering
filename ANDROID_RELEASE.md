# Android Local Release Build (EAS) ve Imza Dogrulama

Bu dokuman, `eas build` oncesinde Android credentials indirme, local production build alma ve cikan build'in dogru imzalandigini dogrulama adimlarini tek yerde toplar.

---

## 0) Gerekenler

- Node.js
- Java (JDK 17 onerilir)
- Android SDK (Android Studio ile gelir)
- EAS CLI

Kurulum:

```bash
npm install -g eas-cli
```

---

## 1) Projeyi hazirla

Proje kokunde:

```bash
npm install
npx expo prebuild
```

Not: `prebuild`, `android/` klasorunu olusturur/gunceller.

---

## 2) EAS hesabini kontrol et

```bash
eas whoami
```

Dogru hesapta degilsen once login ol:

```bash
eas login
```

---

## 3) Build oncesi Android credentials indir (zorunlu kontrol)

Eger localde `credentials.json` ve keystore yoksa, EAS'ten indir.

```bash
eas credentials
```

Sonra menude:

1. `Android` sec
2. `production` profile sec
3. `credentials.json: Upload/Download credentials between EAS servers and your local json`
4. `Download credentials from EAS to credentials.json`

Beklenen sonuc:

- `credentials.json` guncellenir
- `credentials/android/keystore.jks` olusur

Guvenlik notu:

- `credentials.json` ve `credentials/android/keystore.jks` dosyalarini repoya commit etme.

---

## 4) Local production build al

```bash
eas build -p android --profile production --local
```

`eas.json` icinde `production.android.buildType = app-bundle` ise sonuc `.aab` olur (Play Store icin onerilen).

---

## 5) Cikan build'in imzasini dogrula

Asagidaki mantikla kontrol et:

1. Build dosyasindan sertifika fingerprint'lerini oku
2. Local keystore'dan fingerprint'leri oku
3. Degerler birebir ayniysa imza dogrudur

### 5.1 AAB dosyasi icin (production akisi)

Build dosyasindan fingerprint oku:

```bash
keytool -printcert -jarfile app-release.aab
```

Local keystore fingerprint:

```bash
keytool -list -v -keystore credentials/android/keystore.jks -alias <KEY_ALIAS>
```

`<KEY_ALIAS>` degeri `credentials.json` icindeki `keyAlias` ile ayni olmali.

Karsilastir:

- `SHA1`
- `SHA256`

Iki komuttaki `SHA1` ve `SHA256` ayniysa build, beklenen keystore ile imzalanmistir.

### 5.2 APK dosyasi icin (gerekiyorsa)

```bash
apksigner verify --verbose --print-certs app-release.apk
```

Sonra yine keystore fingerprint ile karsilastir:

```bash
keytool -list -v -keystore credentials/android/keystore.jks -alias <KEY_ALIAS>
```

---

## 6) Play Console notu (onemli)

Play App Signing aktifse:

- Senin yukledigin AAB -> `upload key` ile imzali olur
- Kullaniciya dagitilan son APK -> Google'in `app signing key` ile yeniden imzalanir

Bu nedenle Play Console `App integrity` ekraninda su iki sertifikayi ayri ayri takip et:

- Upload certificate
- App signing certificate

---

## 7) Hızlı komut ozeti

```bash
npm install
npx expo prebuild
eas whoami
eas credentials
eas build -p android --profile production --local
keytool -printcert -jarfile app-release.aab
keytool -list -v -keystore credentials/android/keystore.jks -alias <KEY_ALIAS>
```

---

## Kritik notlar

- Ilk release'te kullandigin keystore cok kritiktir, guvenli sakla.
- `applicationId` (`com.entropywork.smartcatering`) sabit kalmali.
- Play yuklemesi icin AAB tercih et.