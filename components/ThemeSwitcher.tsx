import Colors from '@/constants/Colors';
import { useResolvedTheme, useThemeStore } from '@/lib/store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function ThemeSwitcher() {
    const { toggleTheme } = useThemeStore();
    const theme = useResolvedTheme();

    const isDark = theme === 'dark';
    const colors = Colors[theme];

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    shadowColor: isDark ? '#000' : '#cbd5e1',
                }
            ]}
            onPress={toggleTheme}
        >
            {isDark ? (
                <Ionicons name="sunny" size={20} color="#f8fafc" />
            ) : (
                <Ionicons name="moon" size={20} color="#0f172a" />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    }
});
