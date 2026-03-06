import { useResolvedTheme } from "@/lib/store/themeStore";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
// import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
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

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useResolvedTheme();
  const { user } = useAuth();
  const router = useRouter();

  // Push notification kodları Expo Go ortamında (SDK 53+) hata verdiği için geçici olarak devre dışı bırakıldı.
  /*
  useEffect(() => {
    async function setupNotifications() {
      if (!Device.isDevice) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        let pushTokenString;

        if (projectId) {
          pushTokenString = (
            await Notifications.getExpoPushTokenAsync({
              projectId,
            })
          ).data;
        } else {
          console.log("Expo Go without EAS Config detected. Skipping push token fetch to prevent crash.");
          // We don't throw an error here to prevent the app from freezing on startup
          return;
        }

        console.log("Got push token:", pushTokenString);

        if (user && pushTokenString) {
          await userService.updatePushToken(user.id, pushTokenString);
          console.log("Push token saved to Supabase for user:", user.id);
        }
      } catch (e) {
        console.log("Error fetching push token:", e);
      }
    }

    setupNotifications();
  }, [user]);

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url;
      if (url && typeof url === 'string') {
        router.push(url as any);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);
  */

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
        <Stack.Screen name="order-selection" />
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
