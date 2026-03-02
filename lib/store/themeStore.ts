import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
    toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'system',
            setTheme: (theme) => set({ theme }),
            toggleTheme: () => {
                const current = get().theme;
                // If system, base toggle on what system currently is (but we'd need that value).
                // For simplicity, cycle between light and dark.
                if (current === 'light') set({ theme: 'dark' });
                else set({ theme: 'light' });
            },
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Helper hook to get the actual resolved theme
export const useResolvedTheme = (): 'light' | 'dark' => {
    const { theme } = useThemeStore();
    const systemTheme = useDeviceColorScheme() || 'light';

    if (theme === 'system') return systemTheme;
    return theme;
};
