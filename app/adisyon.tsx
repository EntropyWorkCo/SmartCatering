import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useAuth } from "@/lib/hooks/useAuth";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function AdisyonScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user, loading: authLoading } = useAuth();
    // EĞER KULLANICI HENÜZ YÜKLENMEDİYSE null GÖNDER Kİ ADMİN MODU TETİKLENMESİN
    // Supabase uuid beklediği için standart boş uuid gönderiyoruz
    const { orders, loading } = useAdisyon(authLoading ? "00000000-0000-0000-0000-000000000000" : user?.id || "00000000-0000-0000-0000-000000000000");

    // Filter orders that are specifically unpaid / pending / added to bill
    const pendingOrders = useMemo(() => {
        if (!orders) return [];
        return orders.filter(o => o.status === "PENDING" || o.status === "Bekliyor" || o.payment_status === "UNPAID");
    }, [orders]);

    const totalDebt = useMemo(() => {
        return pendingOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    }, [pendingOrders]);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Adisyonum</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Debt Summary Card */}
                <View style={styles.summaryCard}>
                    <FontAwesome5 name="receipt" size={64} color={theme === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'} style={styles.summaryBgIcon} />
                    <Text style={styles.summaryLabel}>TOPLAM BEKLEYEN BORÇ</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryValue}>₺{totalDebt.toLocaleString('tr-TR')}</Text>
                    </View>
                    <Text style={styles.summarySub}>Açık Adisyonlarınızın Toplamı</Text>
                </View>

                <Text style={styles.sectionTitle}>AÇIK SİPARİŞLER ({pendingOrders.length})</Text>

                {pendingOrders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="fact-check" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Bekleyen adisyonunuz bulunmamaktadır.</Text>
                    </View>
                ) : (
                    pendingOrders.map((order, idx) => (
                        <View key={order.id || idx} style={styles.orderCard}>
                            <View style={styles.orderHeader}>
                                <Text style={styles.orderDate}>
                                    {new Date(order.created_at || order.date).toLocaleDateString('tr-TR')}
                                </Text>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>AÇIK</Text>
                                </View>
                            </View>

                            <View style={styles.orderItems}>
                                {/* Normally we'd map order.items here, assuming order has items array or JSON */}
                                <Text style={styles.orderItemText} numberOfLines={2}>
                                    Satın Alınan Ürünler - Sipariş #{order.order_number || String(order.id).substring(0, 6)}
                                </Text>
                            </View>

                            <View style={styles.orderFooter}>
                                <Text style={styles.orderTotalLabel}>Tutar</Text>
                                <Text style={styles.orderTotalValue}>₺{order.total_amount || 0}</Text>
                            </View>
                        </View>
                    ))
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderColor: colors.surfaceBorder
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },

    scrollContent: { padding: 24, paddingBottom: 40 },

    summaryCard: {
        backgroundColor: colors.text === '#f8fafc' ? colors.primary : '#0f172a',
        borderRadius: 24, padding: 32, marginBottom: 32,
        position: 'relative', overflow: 'hidden',
        shadowColor: colors.text === '#f8fafc' ? colors.primary : '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10
    },
    summaryBgIcon: { position: 'absolute', top: -10, right: -10 },
    summaryLabel: {
        fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
        color: colors.text === '#f8fafc' ? '#064e3b' : '#94a3b8', marginBottom: 8
    },
    summaryRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
    summaryValue: {
        fontSize: 40, fontWeight: '900', letterSpacing: -1,
        color: colors.text === '#f8fafc' ? '#022c22' : '#ffffff'
    },
    summarySub: {
        fontSize: 12, fontWeight: '600',
        color: colors.text === '#f8fafc' ? '#064e3b' : '#94a3b8', opacity: 0.8
    },

    sectionTitle: { fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1.5, marginBottom: 16 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16 },
    emptyText: { fontSize: 14, color: colors.muted, fontWeight: '600' },

    orderCard: {
        backgroundColor: colors.surface, borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    orderDate: { fontSize: 13, fontWeight: 'bold', color: colors.muted },
    statusBadge: { backgroundColor: colors.dangerBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { color: colors.danger, fontSize: 10, fontWeight: '900' },

    orderItems: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder },
    orderItemText: { fontSize: 14, color: colors.text, fontWeight: '500', lineHeight: 20 },

    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderTotalLabel: { fontSize: 14, fontWeight: 'bold', color: colors.muted },
    orderTotalValue: { fontSize: 18, fontWeight: '900', color: colors.text }
});
