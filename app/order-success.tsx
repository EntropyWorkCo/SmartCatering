import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function OrderSuccessScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { orderId, amount } = useLocalSearchParams();

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.iconCircle}>
                    <MaterialIcons name="check" size={64} color="#fff" />
                </View>

                <Text style={styles.title}>Siparişiniz Alındı!</Text>
                <Text style={styles.subtitle}>
                    Siparişiniz başarıyla restoranımıza iletildi. Hazırlanmaya başlandığında size bildireceğiz.
                </Text>

                <View style={styles.detailsCard}>
                    {orderId && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Sipariş No</Text>
                            <Text style={styles.detailValue}>#{String(orderId).substring(0, 8).toUpperCase()}</Text>
                        </View>
                    )}
                    {amount && (
                        <>
                            <View style={styles.detailDivider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Toplam Tutar</Text>
                                <Text style={styles.detailValue}>₺{amount}</Text>
                            </View>
                        </>
                    )}
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => router.push("/(tabs)/past-orders")}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Siparişimi Takip Et</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.push("/(tabs)/home")}
                    activeOpacity={0.8}
                >
                    <Text style={styles.secondaryBtnText}>Ana Sayfaya Dön</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        paddingTop: 80
    },

    iconCircle: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: '#10b981', // Success green
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10
    },

    title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16, marginBottom: 40 },

    detailsCard: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: colors.surfaceBorder,
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { fontSize: 13, color: colors.muted, fontWeight: 'bold' },
    detailValue: { fontSize: 16, color: colors.text, fontWeight: '900' },
    detailDivider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 16 },

    footer: { padding: 24, paddingBottom: 32, gap: 16 },

    primaryBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center'
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    secondaryBtn: {
        backgroundColor: colors.surface,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.surfaceBorder
    },
    secondaryBtnText: { color: colors.text, fontSize: 16, fontWeight: 'bold' }
});
