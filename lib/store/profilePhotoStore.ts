import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface ProfilePhotoStore {
  photoUrl: string | null;
  setPhotoUrl: (url: string | null) => void;
  loadFromStorage: (userId: string, fallbackUrl?: string | null) => Promise<void>;
}

export const useProfilePhotoStore = create<ProfilePhotoStore>((set, get) => ({
  photoUrl: null,

  setPhotoUrl: (url) => set({ photoUrl: url }),

  loadFromStorage: async (userId: string, fallbackUrl?: string | null) => {
    // Aynı oturumda zaten bir değer varsa dokunma
    if (get().photoUrl) return;

    try {
      // 1. AsyncStorage'da güncel signed URL var mı?
      const stored = await AsyncStorage.getItem('profile_photo_' + userId);
      if (stored?.startsWith('https://')) {
        set({ photoUrl: stored });
        return;
      }

      // 2. Eski/geçersiz local URI'yi temizle
      if (stored) {
        await AsyncStorage.removeItem('profile_photo_' + userId);
      }

      // 3. DB'deki avatar_url'den file path çıkar, taze signed URL üret
      const sourceUrl = fallbackUrl;
      if (sourceUrl) {
        // public URL:  .../object/public/avatars/userId/avatar.ext
        // signed URL: .../object/sign/avatars/userId/avatar.ext?token=...
        const match = sourceUrl.match(/avatars\/([^?]+)/);
        if (match) {
          const filePath = match[1];
          const { data } = await supabase.storage
            .from('avatars')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 yıl

          if (data?.signedUrl) {
            set({ photoUrl: data.signedUrl });
            await AsyncStorage.setItem('profile_photo_' + userId, data.signedUrl);
            return;
          }
        }

        // 4. Son çare: fallback URL'yi doğrudan kullan
        set({ photoUrl: sourceUrl });
      }
    } catch (err) {
      console.warn('loadFromStorage error:', err);
      if (fallbackUrl) set({ photoUrl: fallbackUrl });
    }
  },
}));
