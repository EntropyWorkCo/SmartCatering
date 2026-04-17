import { NotificationRegister } from "@/components/NotificationRegister";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import {
    Alert,
    Platform
} from "react-native";
import "react-native-reanimated";

import { useAuth } from "@/lib/hooks/useAuth";
import { useUserRole } from "@/lib/hooks/useUserRole";

export { ErrorBoundary } from "expo-router";

// Keep splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const { role, loading: roleLoading, isAdmin } = useUserRole();
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const loading = !loaded || authLoading || roleLoading;

  // Auth Guard & Initial Redirection logic
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "rating";
    
    console.log("🛠️ ROOT AUTH GUARD:", { segments, role, userId: user?.id, isAdmin, inAuthGroup });

    if (!user) {
      if (!inAuthGroup && !isModalOrRating) {
        console.log("🚀 REDIRECTING TO: /welcome");
        router.replace("/welcome");
      }
      return;
    }

    // User is logged in
    if (inAuthGroup || segments.length < 1) {
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
          // Geçiş sürecinde rol tespiti yapılamazsa kullanıcıyı sistemden atmıyoruz, 
          // varsayılan olarak (tabs) grubuna yönlendiriyoruz.
          if (!roleLoading && segments.length < 1) {
            console.log("🚀 REDIRECTING TO DEFAULT: /(tabs)");
            targetPath = "/(tabs)";
          }
          break;
      }

      if (targetPath) {
        console.log("🚀 REDIRECTING TO:", targetPath);
        router.replace(targetPath);
      }
    }
  }, [user, role, segments, loading, roleLoading]);

  // Hide Splash Screen only when fonts and auth state are loaded
  useEffect(() => {
    if (loaded && !authLoading && !roleLoading) {
      // Role tespiti tamamlanmadan splash'i kapatmıyoruz
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loaded, authLoading, roleLoading]);

  if (!loaded || authLoading || roleLoading) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useResolvedTheme();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const router = useRouter();
  const lastMenuNoteRef = React.useRef<number>(0);

  useEffect(() => {
    // Android Expo Go SDK 53+ has issues with expo-notifications setup.
    const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';
    
    console.log("🔔 BİLDİRİM SİSTEMİ BAŞLATILIYOR... (Admin: " + isAdmin + ", ExpoGo: " + isAndroidExpoGo + ")");

    let responseListener: any;
    let orderChannel: any;
    let menuChannel: any;
    let customerOrderChannel: any;

    if (!isAndroidExpoGo) {
      try {
        const Notifications = require("expo-notifications");

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true, // Legacy, kept for compatibility but others preferred
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const url = response.notification.request.content.data?.url;
          if (url && typeof url === 'string') {
            router.push(url as any);
          }
        });

        // 1. Yeni Sipariş Dinleyicisi (Sadece Admin İçin)
        if (isAdmin) {
          orderChannel = supabase
            .channel('admin-orders-live-root')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'adisyon' }, (payload) => {
              const orderType = payload.new?.order_type;
              
              // Sadece gerçek paket siparişleri bildirim tetiklesin
              // Manuel borç/ödeme girişleri ve Şimdi Ye hariç
              const ignoredTypes = ["Şimdi Ye", "MANUAL_DEBT", "MANUAL_PAYMENT"];
              if (!orderType || ignoredTypes.includes(orderType)) return;

              console.log("🔥 YENİ SİPARİŞ TESPİT EDİLDİ (Root)");
              
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "Yeni Sipariş Alındı! 🛎️",
                  body: "Yeni bir paket siparişi düştü.",
                  sound: true,
                  data: { url: "/(admin)/dashboard" },
                },
                trigger: null,
              }).catch((err: any) => console.error("Notification trigger error:", err));

              Alert.alert("Yeni Sipariş! 🛎️", "Yeni bir paket siparişi sisteminize düştü.");
            })
            .subscribe();
        }
      } catch (err) {
        console.warn("Notification system initialization failed:", err);
      }
    }

    // 2. Günün Menüsü Dinleyicisi (Herkes İçin)
    menuChannel = supabase
      .channel('menu-publish-live-root')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu_items' }, (payload) => {
        if (payload.new?.status === 'active') {
          const now = Date.now();
          if (now - lastMenuNoteRef.current > 10000) {
            console.log("🍽️ GÜNÜN MENÜSÜ YAYINLANDI (Root)");
            lastMenuNoteRef.current = now;
            
            if (!isAndroidExpoGo && !isAdmin) {
              const Notifications = require("expo-notifications");
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "Günün Menüsü Hazır! 🍽️",
                  body: "Lezzetli yemeklerimiz yayına girdi. Hemen inceleyin!",
                  sound: true,
                  data: { url: "/(tabs)/menu" },
                },
                trigger: null,
              }).catch((err: any) => console.error("Menu Notification trigger error:", err));
            }
            
            if (!isAdmin) {
              Alert.alert("Günün Menüsü Hazır! 🍽️", "Yeni ürünler yayına girdi, hemen göz atın!");
            }
          }
        }
      })
      .subscribe();

    // 3. Sipariş Durumu Dinleyicisi (Müşteri İçin)
    // Uygulama açıkken (foreground) sipariş durumunu takip eder ve kullanıcıyı bilgilendirir.
    if (user?.id) {
      console.log("📡 Müşteri sipariş dinleyicisi başlatılıyor... User:", user.id);
      customerOrderChannel = supabase
        .channel(`customer-orders-${user.id}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'adisyon', 
          filter: `user_id=eq.${user.id}` 
        }, (payload) => {
          const newStatus = (payload.new?.status || '').toString().toUpperCase();
          const orderType = payload.new?.order_type || '';
          
          console.log("🔔 SİPARİŞ EVENTİ:", { status: newStatus, type: orderType });
          
          const isReady = ['READY', 'HAZIR'].includes(newStatus);
          const isCompleted = ['COMPLETED', 'TAMAMLANDI'].includes(newStatus);
          
          // Sadece paket servis ve dışarıdan siparişler için bildirim/uyarı göster
          const isDeliveryType = ['Sipariş Ver', 'PAKET'].includes(orderType);

          if (isDeliveryType) {
            // First show the Alert (Safe for all environments)
            // Bu kısım uygulama içinde pop-up uyarısını ve yönlendirmeyi yönetir.
            // Bildirim balonunu (banner) artık remote push (notificationService) yönettiği için buradan kaldırdık.
            if (isReady) {
              Alert.alert("Siparişiniz Yola Çıktı! 🛵", "Yemeğiniz hazırlandı ve şu an yola çıktı. Afiyet olsun!");
            }
            
            if (isCompleted) {
              Alert.alert(
                "Siparişiniz Teslim Edildi ✅",
                "Siparişiniz teslim edildi, değerlendirmek ister misiniz?",
                [
                  { text: "Daha Sonra", style: "cancel" },
                  { 
                    text: "Değerlendir", 
                    onPress: () => {
                      console.log("Değerlendirme sayfasına yönlendiriliyor:", payload.new.id);
                      router.push(`/(tabs)/order-rating?orderId=${payload.new.id}` as any);
                    }
                  }
                ]
              );
            }
          }
        })
        .subscribe((status) => {
          console.log(`📡 Sipariş kanalı durumu (${user.id}):`, status);
        });
    }

    return () => {
      if (responseListener) responseListener.remove();
      if (orderChannel) supabase.removeChannel(orderChannel);
      if (menuChannel) supabase.removeChannel(menuChannel);
      if (customerOrderChannel) supabase.removeChannel(customerOrderChannel);
    };
  }, [user?.id, isAdmin]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <NotificationRegister />
      <Stack screenOptions={{ headerShown: false }}>
        {/* 1. SIRALAMA: Welcome en üstte olmalı ki Tab Bar dışında kalsın */}
        <Stack.Screen name="welcome" />

        {/* 2. SIRALAMA: Auth klasörü */}
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/admin-login" />
        <Stack.Screen name="auth/otp-verify" />

        {/* 3. SIRALAMA: Tab yapısı (Giriş sonrası) */}
        <Stack.Screen name="(tabs)" />

        {/* Yönetici paneli */}
        <Stack.Screen name="(admin)" />

        {/* Customer Screens (Outside Tabs) */}

        <Stack.Screen name="order-success" />
        <Stack.Screen name="adisyon" />
        <Stack.Screen name="account-info" />
        <Stack.Screen name="rating" />
        <Stack.Screen name="support" />

        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
