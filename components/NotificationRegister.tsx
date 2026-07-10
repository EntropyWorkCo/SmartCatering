import React, { useEffect, useRef } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { notificationService } from '@/lib/services/notificationService';
import { userService } from '@/lib/services/userService';
import { useAuth } from '@/lib/hooks/useAuth';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export function NotificationRegister() {
  const { user } = useAuth();
  // İzin uyarısını oturum başına yalnızca 1 kez göster
  const deniedAlertShown = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function register() {
      if (!user?.id) return;
      try {
        const token = await notificationService.registerForPushNotificationsAsync();
        if (cancelled) return;

        if (token) {
          await userService.updatePushToken(user.id, token);
          return;
        }

        // Token alınamadı — sebep izin reddiyse kullanıcıyı Ayarlar'a yönlendir.
        // (Expo Go'da push desteklenmediği için orada uyarı gösterme.)
        if (isExpoGo || deniedAlertShown.current) return;

        const Notifications = require('expo-notifications');
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();

        if (status === 'denied' && !canAskAgain) {
          deniedAlertShown.current = true;
          Alert.alert(
            'Bildirimler Kapalı',
            'Sipariş ve menü bildirimlerini alabilmeniz için bildirim izni gerekiyor. Ayarlar > Bildirimler bölümünden izin verebilirsiniz.',
            [
              { text: 'Daha Sonra', style: 'cancel' },
              {
                text: 'Ayarları Aç',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    }

    register();

    // Kullanıcı Ayarlar'dan izni açıp uygulamaya geri döndüğünde token'ı
    // yeniden kaydetmeyi dene (app background → active geçişi)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') register();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [user?.id]);

  return null;
}
