import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminSettings() {
    const insets = useSafeAreaInsets();

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const handleLogout = () => {
        // Supabase logout işlemleri vs. eklenecek
        router.replace("/welcome");
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Ayarlar</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <MaterialIcons name="manage-accounts" size={48} color={colors.primary} />
                    </View>
                    <Text style={styles.profileName}>Meydan Yönetici</Text>
                    <Text style={styles.profileRole}>Süper Admin Hesabı</Text>
                </View>

                <View style={styles.settingsMenu}>
                    <SettingsBtn
                        icon="payments"
                        label="Birim Fiyat Yönetimi"
                        onPress={() => router.push("/(admin)/unit-price")}
                        colors={colors}
                        styles={styles}
                    />
                    <SettingsBtn
                        icon="bar-chart"
                        label="Raporlar ve İstatistikler"
                        onPress={() => router.push("/(admin)/reports")}
                        colors={colors}
                        styles={styles}
                    />
                    <SettingsBtn
                        icon="admin-panel-settings"
                        label="Giriş Kodunu Değiştir"
                        onPress={() => router.push("/(admin)/change-code")}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={20} color={colors.danger} />
                    <Text style={styles.logoutBtnText}>Güvenli Çıkış</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>MEYDAN LOKANTA ADMİN v1.2.0</Text>
            </ScrollView>
        </View>
    );
}

const SettingsBtn = ({ icon, label, onPress, colors, styles }: any) => (
    <TouchableOpacity style={styles.settingsBtn} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.settingsBtnLeft}>
            <View style={styles.settingsBtnIcon}>
                <MaterialIcons name={icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.settingsBtnLabel}>{label}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </TouchableOpacity>
);

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginRight: 16,
    },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    profileCard: {
        backgroundColor: colors.surface,
        borderRadius: 32,
        padding: 32,
        alignItems: "center",
        marginBottom: 32,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.cardHighlight,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 4,
        borderColor: colors.primary,
        marginBottom: 16,
    },
    profileName: {
        fontSize: 20,
        fontWeight: "900",
        color: colors.text,
        marginBottom: 4,
    },
    profileRole: {
        fontSize: 12,
        fontWeight: "bold",
        color: colors.primary,
    },
    settingsMenu: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        overflow: "hidden",
        marginBottom: 32,
    },
    settingsBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
    },
    settingsBtnLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    settingsBtnIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.cardHighlight,
        alignItems: "center",
        justifyContent: "center",
    },
    settingsBtnLabel: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.text,
    },
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: colors.dangerBg,
        paddingVertical: 16,
        borderRadius: 20,
        marginBottom: 32,
    },
    logoutBtnText: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.danger,
    },
    versionText: {
        textAlign: "center",
        fontSize: 10,
        fontWeight: "bold",
        color: colors.muted,
        opacity: 0.5,
    },
});
