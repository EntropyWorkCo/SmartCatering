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



// ─── GLOBAL BİLDİRİM HANDLER ───
// Uygulama AÇIKKEN gelen bildirimlerin banner olarak düşmesini sağlar.
// Expo Go SDK 53+ artık expo-notifications'ı desteklemiyor.
// Statik import yerine guard içinde lazy require kullanıyoruz.
const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const base: any = {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
        if (Platform.OS === 'ios') {
          base.shouldShowBanner = true;
          base.shouldShowList = true;
        }
        return base;
      },
    });
  } catch (err) {
    console.warn('Notification handler could not be initialized:', err);
  }
}

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error("Critical: Font loading failed:", error);
      // Uygulamanın tamamen çökmesini engellemek için sadece hata basıyoruz, 
      // sistem fontları ile devam etmesine izin veriyoruz.
    }
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
  // Birden fazla eş zamanlı yönlendirmeyi engellemek için kilit
  const isRedirectingRef = React.useRef(false);

  // 2. Auth Guard & Yönlendirme Mantığı
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "order-rating";

    // Kullanıcı giriş yapmamışsa
    if (!user) {
      isRedirectingRef.current = false;
      // Kullanıcı yoksa bekleyen welcome yönlendirmesini iptal et (user değişimi)
      if (pendingWelcomeRef.current) {
        clearTimeout(pendingWelcomeRef.current);
        pendingWelcomeRef.current = null;
      }
      if (!inAuthGroup && !isModalOrRating) {
        // Korumalı sayfadayız ve kullanıcı kesinlikle yok → Welcome'a yönlendir
        pendingWelcomeRef.current = setTimeout(() => {
          // Timer ateşlendiğinde son kez kontrol et — giriş gerçekleştiyse gitme
          if (!useAuthStore.getState().user) {
            console.log("🚀 YÖNLENDİRİLİYOR: /welcome");
            router.replace("/welcome");
          }
          pendingWelcomeRef.current = null;
        }, 2000);  // 1500→2000ms: ağır ağlarda biraz daha marj
      }
      return;
    }

    // Kullanıcı giriş yaptı — bekleyen /welcome redirect'ini iptal et
    if (pendingWelcomeRef.current) {
      clearTimeout(pendingWelcomeRef.current);
      pendingWelcomeRef.current = null;
    }

    // Rol henüz belirlenmemiş (null) — yönlendirme yapma, bekle
    if (role === null) {
      console.log("⏳ Rol bekleniyor, yönlendirme ertelendi");
      return;
    }

    // Kullanıcı giriş yapmışsa ve auth/index sayfasındaysa yönlendir
    if (inAuthGroup || !segments[0]) {
      // Eğer zaten yönlendirme yapılıyorsa tekrar yapma
      if (isRedirectingRef.current) {
        console.log("🔒 Zaten yönlendiriliyor, atlandı");
        return;
      }

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
          // Bilinmeyen rol — güvenli tarafta kal
          targetPath = "/(tabs)";
          break;
      }

      if (targetPath) {
        isRedirectingRef.current = true;
        console.log("🚀 ROL BAZLI YÖNLENDİRME:", role, "->", targetPath);
        router.replace(targetPath);
        // Yönlendirme bittikten sonra kilidi aç
        setTimeout(() => { isRedirectingRef.current = false; }, 500);
      }
    }
  // authLoading dependency KASITLI OLARAK ÇIKARILDI:
  // authLoading değişimi çift yönlendirmeye (sayfa üst üste binmesi) neden oluyordu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, segments, loading]);

  // User set olduğu an /welcome timer'ını iptal et (loading bitmese bile)
  useEffect(() => {
    if (user && pendingWelcomeRef.current) {
      clearTimeout(pendingWelcomeRef.current);
      pendingWelcomeRef.current = null;
    }
  }, [user]);

  // GÜVENLİK AĞLARI: user varken role null kalırsa 8sn sonra 'bireysel' zorla
  useEffect(() => {
    if (!user || role !== null) return;
    const fallbackTimer = setTimeout(() => {
      const st = useAuthStore.getState();
      if (st.user && st.role === null) {
        console.warn("⚠️ _layout: Rol 8sn boyunca belirlenemedi, 'bireysel' olarak devam ediliyor.");
        useAuthStore.setState({ role: 'bireysel', firmaId: null, isAdmin: false });
      }
    }, 8000);
    return () => clearTimeout(fallbackTimer);
  }, [user, role]);

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

  console.log("DEBUG - Current User ID:", user?.id);
  console.log("DEBUG - Current User Role:", role);
  console.log("DEBUG - Is Admin Mode Active:", isAdmin);

  // 3. Arka Plan Dinleyicileri (Realtime Listeners)
  useEffect(() => {
    if (loading || !user?.id) return;

    let orderChannel: any;
    let customerOrderChannel: any;
    let responseListener: any;

    const setupListeners = async () => {
      try {
        const isAndroidExpoGo = Platform.OS === 'android' && (Constants.appOwnership as any) === 'expo';
        
        if (!isAndroidExpoGo) {
          const Notifications = require("expo-notifications");
          responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
            const data = response.notification.request.content.data;
            if (data?.url) {
              if (data.screen === "order-rating" && data.orderId) {
                router.push(`/order-rating?orderId=${data.orderId}` as any);
              } else {
                router.push(data.url as any);
              }
            }
          });
        }

        // --- ADMIN: Yeni Sipariş Bildirimleri ---
        if (isAdmin) {
          const adminChannelId = `admin-orders-${Math.random().toString(36).substring(7)}`;
          orderChannel = supabase
            .channel(adminChannelId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'adisyon' }, (payload: any) => {
              const type = payload.new?.order_type;
              if (type !== "Şimdi Ye" && type !== "MANUAL_DEBT" && type !== "MANUAL_PAYMENT") {
                Alert.alert("Yeni Paket Siparişi! 🛎️", "Yeni bir paket siparişi düştü.");
              }
            })
            .subscribe();
        }

        // --- MÜŞTERİ: Sipariş Durum Güncellemeleri ---
        const customerChannelId = `customer-status-${user.id}-${Math.random().toString(36).substring(7)}`;
        customerOrderChannel = supabase
          .channel(customerChannelId)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'adisyon', 
            filter: `user_id=eq.${user.id}` 
          }, (payload: any) => {
            const status = (payload.new?.status || '').toString().toUpperCase();
            
            if (['PREPARING', 'HAZIRLANIYOR'].includes(status)) {
              Alert.alert("Siparişiniz Alındı 👨‍🍳", "Yemeğiniz hazırlanmaya başladı. Afiyet olsun!");
            } else if (['READY', 'HAZIR'].includes(status)) {
              Alert.alert("Siparişiniz Yola Çıktı! 🛵", "Yemeğiniz yola çıktı, afiyet olsun!");
            } else if (['COMPLETED', 'TAMAMLANDI'].includes(status)) {
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
          })
          .subscribe();

      } catch (err) {
        console.warn("Realtime setup failed:", err);
      }
    };

    setupListeners();

    return () => {
      if (responseListener) responseListener.remove();
      if (orderChannel) supabase.removeChannel(orderChannel);
      if (customerOrderChannel) supabase.removeChannel(customerOrderChannel);
    };
  }, [user?.id, isAdmin, loading]);

  // Firma sahibi için arka planda günlük yemek bildirimi kontrolü
  useEffect(() => {
    if (loading || !user?.id || role !== 'owner') return;

    const runDailyMealCheck = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const { notificationService } = require('@/lib/services/notificationService');
        const { userService } = require('@/lib/services/userService');

        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();

        // 13:00-15:00 (çalışan hatırlatma) veya 16:00-20:00 (firma sahibi özet) değilse çalıştırma
        if (!((hour >= 13 && hour < 15) || (hour >= 16 && hour < 20))) return;

        const reminderKey = `meal_reminder_sent_${today}`;
        const summaryKey  = `meal_summary_sent_${today}`;
        const reminderSent = await AsyncStorage.getItem(reminderKey);
        const summarySent  = await AsyncStorage.getItem(summaryKey);

        // İkisi de gönderildiyse çalışma
        if (reminderSent && summarySent) return;

        // Çalışanları ve bugünkü siparişleri çek
        const { data: companyRow } = await supabase
          .from('companies').select('id').eq('user_id', user.id).maybeSingle();
        if (!companyRow) return;

        const allEmps = await userService.getCompanyEmployees(companyRow.id);
        const everyone = [
          { id: user.id },
          ...allEmps
        ].filter((e: any) => e.id);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: todayOrders } = await supabase
          .from('adisyon')
          .select('user_id')
          .in('user_id', everyone.map((e: any) => e.id))
          .not('order_type', 'in', '("MANUAL_DEBT","MANUAL_PAYMENT")')
          .not('status', 'in', '("CANCELLED","İptal")')
          .gte('created_at', todayStart.toISOString());

        const doneIds = new Set((todayOrders || []).map((o: any) => o.user_id));
        const notDoneIds = everyone
          .filter((e: any) => !doneIds.has(e.id) && e.id !== user.id)
          .map((e: any) => e.id);
        const doneEmps = allEmps.filter((e: any) => doneIds.has(e.id));

        // Sabah: yapmayanlara push
        // 13:00–15:00: yapmayanlara hatırlatma push
        if (!reminderSent && hour >= 13 && hour < 15 && notDoneIds.length > 0) {
          await notificationService.sendViaEdgeFunction({
            type: 'MEAL_REMINDER',
            title: '🍽️ Bugün yemek yediniz mi?',
            body: 'Bugün henüz yemek kaydı yapılmadı. Sipariş vermek için uygulamayı açın.',
            data: { screen: 'home' },
            userIds: notDoneIds,
          });
          await AsyncStorage.setItem(reminderKey, 'true');
          console.log(`[Arka plan] Sabah hatırlatması → ${notDoneIds.length} kişi`);
        }

        // Akşam: firma sahibine özet push
        if (!summarySent && hour >= 16 && hour < 20) {
          const names = doneEmps.map((e: any) => e.full_name?.split(' ')[0]).filter(Boolean);
          const body = names.length > 0
            ? `${names.join(', ')} bugün yemek yedi. (${doneEmps.length}/${allEmps.length} çalışan)`
            : 'Bugün hiçbir çalışan yemek bildirimi yapmadı.';

          await notificationService.sendViaEdgeFunction({
            type: 'MEAL_REMINDER',
            title: '📊 Günlük Yemek Özeti',
            body,
            data: { screen: 'corporate-info' },
            userId: user.id,
          });
          await AsyncStorage.setItem(summaryKey, 'true');
          console.log(`[Arka plan] Akşam özeti → firma sahibine`);
        }
      } catch (e) {
        console.warn('[Arka plan] Günlük yemek kontrolü hatası:', e);
      }
    };

    runDailyMealCheck();
  }, [user?.id, role, loading]);

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
