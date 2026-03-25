import { useResolvedTheme } from "@/lib/store/themeStore";
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
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Auth Guard & Initial Redirection logic
  useEffect(() => {
    if (!loaded || authLoading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "welcome";
    const isModalOrRating = segments[0] === "modal" || segments[0] === "rating";

    // Determine target path
    let targetPath = "";
    
    if (!user && !inAuthGroup && !isModalOrRating) {
      targetPath = "/welcome";
    } else if (user && inAuthGroup) {
      targetPath = isAdmin ? "/(admin)/dashboard" : "/(tabs)";
    }

    if (targetPath) {
      router.replace(targetPath as any);
    } else {
      // If we are already on the correct path, we are ready
      setIsReady(true);
    }
  }, [user, isAdmin, segments, authLoading, loaded]);

  // Hide Splash Screen only when EVERYTHING is ready
  useEffect(() => {
    if (loaded && !authLoading && isReady) {
      // Small delay to ensure the target screen has had a chance to render its first frame
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loaded, authLoading, isReady]);

  if (!loaded || authLoading) {
    return null;
  }

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
