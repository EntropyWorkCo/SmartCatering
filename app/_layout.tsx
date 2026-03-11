import { useResolvedTheme } from "@/lib/store/themeStore";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
// import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { useAuth } from "@/lib/hooks/useAuth";

export { ErrorBoundary } from "expo-router";

/*
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
*/

// initialRouteName kaldırıldı veya "welcome" yapıldı
// unstable_settings iOS'ta kaydırma (swipe) ile welcome'a dönme sorununa yol açabileceği için kaldırıldı.

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

  useEffect(() => {
    if (loaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authLoading]);

  // Auth Guard: Watch for changes in user / segment
  useEffect(() => {
    if (!loaded || authLoading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";

    // Eğer kullanıcı giriş yapmamışsa ve kayıt/giriş sayfalarında değilse
    if (
      !user &&
      !inAuthGroup &&
      segments[0] !== "order-selection" &&
      segments[0] !== "modal" &&
      segments[0] !== "rating"
    ) {
      router.replace("/welcome");
    }
    // Eğer kullanıcı zaten giriş yapmışsa ve kayıt/giriş sayfalarındaysa
    else if (user && inAuthGroup) {
      // Admin ise yönetici paneline yolla
      if (isAdmin) {
        router.replace("/(admin)/dashboard");
      } else {
        // Yoksa müşteri paneline yolla
        router.replace("/(tabs)");
      }
    }
  }, [user, isAdmin, segments, authLoading, loaded]);

  if (!loaded || authLoading) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useResolvedTheme();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Android Expo Go SDK 53+ has issues with expo-notifications setup.
    // We bypass it to prevent crashes, using our Alert fallback in notificationService instead.
    const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';
    if (isAndroidExpoGo) return;

    try {
      const Notifications = require("expo-notifications");

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
        }),
      });

      const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const url = response.notification.request.content.data?.url;
        if (url && typeof url === 'string') {
          router.push(url as any);
        }
      });

      return () => {
        responseListener.remove();
      };
    } catch (error) {
      console.log("Notification listener setup failed (non-critical):", error);
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 1. SIRALAMA: Welcome en üstte olmalı ki Tab Bar dışında kalsın */}
        <Stack.Screen name="welcome" />

        {/* 2. SIRALAMA: Auth klasörü */}
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/admin-login" />
        <Stack.Screen name="auth/register" />

        {/* 3. SIRALAMA: Tab yapısı (Giriş sonrası) */}
        <Stack.Screen name="(tabs)" />

        {/* Yönetici paneli */}
        <Stack.Screen name="(admin)" />

        {/* Customer Screens (Outside Tabs) */}

        <Stack.Screen name="order-success" />
        <Stack.Screen name="adisyon" />
        <Stack.Screen name="account-info" />
        <Stack.Screen name="corporate-info" />
        <Stack.Screen name="rating" />
        <Stack.Screen name="support" />

        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
