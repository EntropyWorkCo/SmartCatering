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

export { ErrorBoundary } from "expo-router";

// Keep splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const { user, loading: authLoading, isAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Auth Guard & Initial Redirection logic
  useEffect(() => {
    if (!loaded || authLoading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "rating";
    
    console.log("🛠️ ROOT AUTH GUARD:", { segments, userId: user?.id, isAdmin, inAuthGroup });

    // Determine target path
    let targetPath = "";
    
    if (!user && !inAuthGroup && !isModalOrRating) {
      targetPath = "/welcome";
    } else if (user && (inAuthGroup || segments.length < 1)) {
      targetPath = isAdmin ? "/(admin)/dashboard" : "/(tabs)";
    }

    if (targetPath) {
      console.log("🚀 REDIRECTING TO:", targetPath);
      router.replace(targetPath as any);
    }
  }, [user, isAdmin, segments, authLoading, loaded]);

  // Hide Splash Screen only when fonts and auth state are loaded
  useEffect(() => {
    if (loaded && !authLoading) {
      // Give a tiny bit of time for the initial navigation to settle
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loaded, authLoading]);

  if (!loaded || authLoading) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useResolvedTheme();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const lastMenuNoteRef = React.useRef<number>(0);

  useEffect(() => {
    // Android Expo Go SDK 53+ has issues with expo-notifications setup.
    const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';
    
    console.log("🔔 BİLDİRİM SİSTEMİ BAŞLATILIYOR... (Admin: " + isAdmin + ", ExpoGo: " + isAndroidExpoGo + ")");

    let responseListener: any;
    let orderChannel: any;
    let menuChannel: any;

    if (!isAndroidExpoGo) {
      try {
        const Notifications = require("expo-notifications");

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
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

    return () => {
      if (responseListener) responseListener.remove();
      if (orderChannel) supabase.removeChannel(orderChannel);
      if (menuChannel) supabase.removeChannel(menuChannel);
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
