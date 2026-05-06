import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import Constants from 'expo-constants';
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, LogBox, Platform, useColorScheme, View } from "react-native";

// Supabase'in arka plandaki refresh token yenileme mekanizması token geçerliliğini yitirdiğinde
// bu hatayı fırlatır. Uygulamayı bozmaz, ancak geliştirme modunda ekranda kırmızı kutu çıkar.
// Bunu gizlemek için:
LogBox.ignoreLogs([
  'AuthApiError: Invalid Refresh Token', 
  'Refresh Token Not Found',
  'No native splash screen registered'
]);

import { NotificationRegister } from "@/components/NotificationRegister";
import { useAuthStore } from "@/lib/store/authStore";
import { supabase } from "@/lib/supabase";

import * as Notifications from "expo-notifications";

// ─── GLOBAL BİLDİRİM HANDLER ───
// Uygulama AÇIKKEN gelen bildirimlerin banner olarak düşmesini sağlar.
if (Platform.OS !== 'android' || Constants.appOwnership !== 'expo') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowList: true,
      shouldShowBanner: true,
    }),
  });
}

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

  // GÜVENLİK KİLİDİ: Eğer oturum kontrolü 4 saniye içinde tamamlanmazsa (bozuk token vb.) 
  // beyaz ekranda takılı kalmamak için yüklemeyi zorla bitir.
  const [forceLoad, setForceLoad] = React.useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceLoad(true);
    }, 6000); // 6 saniye — yavaş ağlarda rol belirlenmeden yönlendirme olmasın
    return () => clearTimeout(timer);
  }, []);

  const loading = !loaded || (authLoading && !forceLoad);

  // 1. Splash Screen Kontrolü
  useEffect(() => {
    let isMounted = true;
    
    if (loaded || forceLoad) {
      const timer = setTimeout(async () => {
        if (!isMounted) return;
        try {
          await SplashScreen.hideAsync();
        } catch (err) {
          // Bu hata genellikle hot-reload sırasında zaten kapalı olduğu için çıkar, görmezden geliyoruz.
        }
      }, 500);
      
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [loaded, forceLoad]);

  const pendingWelcomeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Auth Guard & Yönlendirme Mantığı
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "order-rating";

    // Kullanıcı giriş yapmamışsa
    if (!user) {
      if (inAuthGroup || isModalOrRating) {
        // Giriş sayfasındayız, varsa bekleyen yönlendirmeyi iptal et (Geri atmasın)
        if (pendingWelcomeRef.current) {
          clearTimeout(pendingWelcomeRef.current);
          pendingWelcomeRef.current = null;
        }
      } else {
        // Korumalı sayfadayız (Tabs gibi) ve kullanıcı yok -> Welcome'a yönlendir
        // Zaten bir sayaç varsa tekrar başlatma
        if (!pendingWelcomeRef.current) {
          pendingWelcomeRef.current = setTimeout(() => {
            console.log("🚀 YÖNLENDİRİLİYOR: /welcome");
            router.replace("/welcome");
            pendingWelcomeRef.current = null;
          }, 1500);
        }
      }
      return;
    }

    // Kullanıcı giriş yaptı — bekleyen /welcome redirect'ini iptal et
    if (pendingWelcomeRef.current) {
      clearTimeout(pendingWelcomeRef.current);
      pendingWelcomeRef.current = null;
    }

    // Kullanıcı giriş yapmışsa ve ana sayfadaysa (veya auth sayfalarındaysa) yönlendir
    if (inAuthGroup || !segments[0]) {
      let targetPath: any = "";

      switch (role) {
        case "admin":
          targetPath = "/(admin)/dashboard";
          break;
        case "firma_sahibi":
        case "firma_calisan":
        case "bireysel":
          targetPath = "/(tabs)";
          break;
        default:
          if (!authLoading) targetPath = "/(tabs)";
          break;
      }

      if (targetPath) {
        console.log("🚀 ROL BAZLI YÖNLENDİRME:", targetPath);
        router.replace(targetPath);
      }
    }
  }, [user, role, segments, loading, authLoading]);

  // User set olduğu an /welcome timer'ını iptal et (loading bitmese bile)
  useEffect(() => {
    if (user && pendingWelcomeRef.current) {
      clearTimeout(pendingWelcomeRef.current);
      pendingWelcomeRef.current = null;
    }
  }, [user]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

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
      const isAndroidExpoGo = Platform.OS === 'android' && (Constants.appOwnership as any) === 'expo';
      if (isAndroidExpoGo) {
        console.log("⚠️ Android Expo Go: Bildirim sistemi devre dışı bırakıldı (SDK 53+ Kısıtlaması).");
      }

      let orderChannel: any;
      let customerOrderChannel: any;
      let responseListener: any;
      let foregroundListener: any;

      try {
        if (!isAndroidExpoGo) {
          const Notifications = require("expo-notifications");

          // Uygulama AÇIKKEN bildirime tıklanınca yönlendirme
          responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
            const data = response.notification.request.content.data;
            if (data?.url) {
              console.log('📲 Bildirim tıklandı (app açık), yönlendiriliyor:', data.url);
              if (data.screen === "order-rating" && data.orderId) {
                router.push(`/order-rating?orderId=${data.orderId}` as any);
              } else {
                router.push(data.url as any);
              }
            }
          });

          // ─── KILLED STATE DEEP LINK ─────────────────────────────────────────
          // Uygulama tamamen kapalıyken bildirime tıklandığında:
          // Expo Notifications, uygulamayı açar ve getLastNotificationResponseAsync()
          // ile o anki bildirimi verir.
          Notifications.getLastNotificationResponseAsync().then((response: any) => {
            if (response) {
              const data = response.notification?.request?.content?.data;
              if (data?.url) {
                console.log('📲 Killed state bildirim tıklaması, yönlendiriliyor:', data.url);
                // Kısa gecikme: router henüz hazır olmayabilir
                setTimeout(() => {
                  if (data.screen === "order-rating" && data.orderId) {
                    router.push(`/order-rating?orderId=${data.orderId}` as any);
                  } else {
                    router.push(data.url as any);
                  }
                }, 500);
              }
            }
          }).catch(() => {});
        }

        if (isAdmin) {
          const adminChannelName = 'admin-orders-live-root';
          const existingAdminChannel = supabase.getChannels().find(c => c.topic === `realtime:${adminChannelName}`);
          if (existingAdminChannel) supabase.removeChannel(existingAdminChannel);

          orderChannel = supabase
            .channel(adminChannelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'adisyon' }, (payload: any) => {
              if (payload.new?.order_type !== "Şimdi Ye") {
                Alert.alert("Yeni Paket Siparişi! 🛎️", "Yeni bir paket siparişi düştü.");
              }
            });
          
          orderChannel.subscribe();
        }

        // Müşteri: Sipariş durum güncellemelerini dinle
        const customerChannelName = `customer-status-${user.id}`;
        const existingCustChannel = supabase.getChannels().find(c => c.topic === `realtime:${customerChannelName}`);
        if (existingCustChannel) supabase.removeChannel(existingCustChannel);

        customerOrderChannel = supabase
          .channel(customerChannelName)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adisyon', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            const status = (payload.new?.status || '').toString().toUpperCase();
            
            if (['READY', 'HAZIR'].includes(status)) {
              Alert.alert("Siparişiniz Yola Çıktı! 🛵", "Yemeğiniz yola çıktı, afiyet olsun!");
            }

            if (['COMPLETED', 'TAMAMLANDI'].includes(status)) {
              Alert.alert(
                "Siparişiniz Teslim Edildi ✅", 
                "Afiyet olsun! Değerlendirmenizi bekliyoruz.",
                [
                  { text: "Kapat", style: "cancel" },
                  { 
                    text: "Değerlendir", 
                    onPress: () => router.push(`/order-rating?orderId=${payload.new.id}` as any) 
                  }
                ]
              );
            }
          });
        
        customerOrderChannel.subscribe();

      } catch (err) {
        console.warn("Background tasks skipped/failed:", err);
      }

      return () => {
        if (responseListener) responseListener.remove();
        if (foregroundListener) foregroundListener.remove();
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
