import React, { useEffect } from 'react';
import { notificationService } from '@/lib/services/notificationService';
import { userService } from '@/lib/services/userService';
import { useAuth } from '@/lib/hooks/useAuth';

export function NotificationRegister() {
  const { user } = useAuth();

  useEffect(() => {
    async function register() {
      if (user?.id) {
        try {
          const token = await notificationService.registerForPushNotificationsAsync();
          if (token) {
            await userService.updatePushToken(user.id, token);
          } else {
            console.log("Push token alınmadı (Bu durum Android Expo Go üzerinde test edilirken veya izin verilmediğinde normaldir).");
          }
        } catch (error) {
          console.error('Error registering push notifications:', error);
        }
      }
    }

    register();
  }, [user?.id]);

  return null;
}
