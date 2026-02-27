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

    const handleLogout = () => {
        // Supabase logout işlemleri vs. eklenecek
        router.replace("/welcome");
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.title}>Ayarlar</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <MaterialIcons name="manage-accounts" size={48} color="#74CF62" />
                    </View>
                    <Text style={styles.profileName}>Meydan Yönetici</Text>
                    <Text style={styles.profileRole}>Süper Admin Hesabı</Text>
                </View>

                <View style={styles.settingsMenu}>
                    <SettingsBtn
                        icon="payments"
                        label="Birim Fiyat Yönetimi"
                        onPress={() => router.push("/(admin)/unit-price")}
                    />
                    <SettingsBtn
                        icon="bar-chart"
                        label="Raporlar ve İstatistikler"
                        onPress={() => router.push("/(admin)/reports")}
                    />
                    <SettingsBtn
                        icon="admin-panel-settings"
                        label="Giriş Kodunu Değiştir"
                        onPress={() => router.push("/(admin)/change-code")}
                    />
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={20} color="#ef4444" />
                    <Text style={styles.logoutBtnText}>Güvenli Çıkış</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>MEYDAN LOKANTA ADMİN v1.2.0</Text>
            </ScrollView>
        </View>
    );
}

const SettingsBtn = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={styles.settingsBtn} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.settingsBtnLeft}>
            <View style={styles.settingsBtnIcon}>
                <MaterialIcons name={icon} size={20} color="#74CF62" />
            </View>
            <Text style={styles.settingsBtnLabel}>{label}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
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
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginRight: 16,
    },
    title: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    profileCard: {
        backgroundColor: "#fff",
        borderRadius: 32,
        padding: 32,
        alignItems: "center",
        marginBottom: 32,
        borderWidth: 1,
        borderColor: "#f1f5f9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(116, 207, 98, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 4,
        borderColor: "rgba(116, 207, 98, 0.2)",
        marginBottom: 16,
    },
    profileName: {
        fontSize: 20,
        fontWeight: "900",
        color: "#0f172a",
        marginBottom: 4,
    },
    profileRole: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#74CF62",
    },
    settingsMenu: {
        backgroundColor: "#fff",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#f1f5f9",
        overflow: "hidden",
        marginBottom: 32,
    },
    settingsBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
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
        backgroundColor: "rgba(116, 207, 98, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    settingsBtnLabel: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#0f172a",
    },
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        paddingVertical: 16,
        borderRadius: 20,
        marginBottom: 32,
    },
    logoutBtnText: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#ef4444",
    },
    versionText: {
        textAlign: "center",
        fontSize: 10,
        fontWeight: "bold",
        color: "#94a3b8",
        opacity: 0.5,
    },
});
