import React, { useEffect } from "react";
import { Platform, Alert, useColorScheme } from "react-native";
import { Stack, useSegments, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Constants from 'expo-constants';
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "@/lib/store/authStore";
import { supabase } from "@/lib/supabase";
import { NotificationRegister } from "@/components/NotificationRegister";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  return <RootLayoutNavWrapper loaded={loaded} />;
}

function RootLayoutNavWrapper({ loaded }: { loaded: boolean }) {
  const { user, role, loading: authLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, []);

  // GÜVENLİK KİLİDİ: Eğer oturum kontrolü 5 saniye içinde tamamlanmazsa (bozuk token vb.) 
  // beyaz ekranda takılı kalmamak için yüklemeyi zorla bitir.
  const [forceLoad, setForceLoad] = React.useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceLoad(true);
    }, 2000); // 2 saniye yeterli
    return () => clearTimeout(timer);
  }, []);

  const loading = !loaded || (authLoading && !forceLoad);

  // 1. Splash Screen Kontrolü
  useEffect(() => {
    // Hem fontlar yüklendiğinde HEM DE zorla açma (forceLoad) tetiklendiğinde splash'i kapat
    if (loaded || forceLoad) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loaded, forceLoad]);

  // 2. Auth Guard & Yönlendirme Mantığı
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "order-rating";
    
    // Kullanıcı giriş yapmamışsa
    if (!user) {
        if (!inAuthGroup && !isModalOrRating) {
            console.log("🚀 YÖNLENDİRİLİYOR: /welcome");
            router.replace("/welcome");
        }
        return;
    }

    // Kullanıcı giriş yapmışsa ve ana sayfadaysa (veya auth sayfalarındaysa) yönlendir
    if (inAuthGroup || segments.length === 0) {
        let targetPath: any = "";
        
        switch(role) {
            case 'admin':
                targetPath = "/(admin)/dashboard";
                break;
            case 'firma_sahibi':
            case 'firma_calisan':
            case 'bireysel':
                targetPath = "/(tabs)";
                break;
            default:
                // Henüz rol belirlenmediyse (nadir durum)
                if (!authLoading) targetPath = "/(tabs)";
                break;
        }

        if (targetPath) {
            console.log("🚀 ROL BAZLI YÖNLENDİRME:", targetPath);
            router.replace(targetPath);
        }
    }
  }, [user, role, segments, loading, authLoading]);

  if (!loaded) return null;

  return <RootLayoutNav user={user} role={role} loading={loading} />;
}

function RootLayoutNav({ user, role, loading }: any) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isAdmin = role === 'admin';

  // 3. Arka Plan Dinleyicileri (GECİKTİRİLMİŞ BAŞLATMA - DONMAYI ÖNLER)
  useEffect(() => {
    if (loading || !user?.id) return;

    const deferredTimer = setTimeout(() => {
      // ÖNEMLİ: Expo SDK 53+ Versiyonunda Android Expo Go bildirimleri desteklemiyor.
      // Bu hata uygulamanın donmasına neden olmasın diye Expo Go'da bu kısmı atlıyoruz.
      const isAndroidExpoGo = Platform.OS === 'android' && (Constants.appOwnership as any) === 'expo';
      if (isAndroidExpoGo) {
        console.log("⚠️ Android Expo Go: Bildirim sistemi devre dışı bırakıldı (SDK 53+ Kısıtlaması).");
      }

      let orderChannel: any;
      let customerOrderChannel: any;
      let responseListener: any;

      try {
        if (!isAndroidExpoGo) {
          const Notifications = require("expo-notifications");
          
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });

          responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
            const url = response.notification.request.content.data?.url;
            if (url) router.push(url as any);
          });
        }

        if (isAdmin) {
          orderChannel = supabase
            .channel('admin-orders-live-root')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'adisyon' }, (payload: any) => {
              if (payload.new?.order_type !== "Şimdi Ye") {
                // Güvenli Bildirim Gönderimi
                if (!isAndroidExpoGo) {
                  const Notifications = require("expo-notifications");
                  Notifications.scheduleNotificationAsync({
                    content: { title: "Yeni Sipariş! 🛎️", body: "Paket siparişi düştü.", sound: true, data: { url: "/(admin)/dashboard" } },
                    trigger: null,
                  }).catch(() => {});
                }
                Alert.alert("Yeni Sipariş! 🛎️", "Yeni bir paket siparişi düştü.");
              }
            })
            .subscribe();
        }

        customerOrderChannel = supabase
          .channel(`customer-status-${user.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adisyon', filter: `user_id=eq.${user.id}` }, (payload: any) => {
             const status = (payload.new?.status || '').toString().toUpperCase();
             if (['READY', 'HAZIR'].includes(status)) {
               Alert.alert("Siparişiniz Yola Çıktı! 🛵", "Yemeğiniz yola çıktı, afiyet olsun!");
             }
          })
          .subscribe();

      } catch (err) {
        console.warn("Background tasks skipped/failed:", err);
      }

      return () => {
        if (responseListener) responseListener.remove();
        if (orderChannel) supabase.removeChannel(orderChannel);
        if (customerOrderChannel) supabase.removeChannel(customerOrderChannel);
      };
    }, 3000);

    return () => clearTimeout(deferredTimer);
  }, [user?.id, isAdmin, loading]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <NotificationRegister />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/admin-login" />
        <Stack.Screen name="auth/otp-verify" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="order-success" />
        <Stack.Screen name="adisyon" />
        <Stack.Screen name="account-info" />
        <Stack.Screen name="rating" />
        <Stack.Screen name="support" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
