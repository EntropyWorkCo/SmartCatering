import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function PastOrdersScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user, loading: authLoading } = useAuth();
    const { profile } = useProfile(user?.id);
    const isCompany = profile?.is_company || false;

    // EĞER KULLANICI HENÜZ YÜKLENMEDİYSE null GÖNDER Kİ ADMİN MODU TETİKLENMESİN
    // Supabase uuid beklediği için standart boş uuid gönderiyoruz
    const { orders, loading, fetchOrders } = useAdisyon(authLoading ? "00000000-0000-0000-0000-000000000000" : user?.id || "00000000-0000-0000-0000-000000000000");
    const [timeFilter, setTimeFilter] = useState<"ALL" | "DAILY" | "WEEKLY" | "MONTHLY">("ALL");

    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [itemRatings, setItemRatings] = useState<{ [key: string]: number }>({});
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [ratedOrders, setRatedOrders] = useState<string[]>([]);

    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            if (fetchOrders) await fetchOrders();
        } finally {
            setRefreshing(false);
        }
    }, [fetchOrders]);

    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                supabase.from("feedbacks").select("order_id").eq("user_id", user.id).not("order_id", "is", null)
                    .then(({ data }) => {
                        if (data) setRatedOrders(data.map((d: any) => d.order_id));
                    });
            }
        }, [user?.id])
    );

    const handleEvaluate = (orderId: string) => {
        router.push({
            pathname: "/(tabs)/order-rating",
            params: { orderId }
        });
    };

    // Sort orders descending by date
    const sortedOrders = useMemo(() => {
        if (!orders) return [];
        const now = new Date();

        const filtered = orders.filter((order: any) => {
            // Manuel finans kayıtlarını (borç/ödeme) kullanıcının kişisel sipariş geçmişinden gizle
            if (order.order_type === 'MANUAL_DEBT' || order.order_type === 'MANUAL_PAYMENT') {
                return false;
            }

            if (timeFilter === "ALL") return true;

            const orderDate = new Date(order.created_at || order.date);
            const diffTime = Math.abs(now.getTime() - orderDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (timeFilter === "DAILY") {
                // Same day logic
                return orderDate.getDate() === now.getDate() && orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
            }
            if (timeFilter === "WEEKLY") return diffDays <= 7;
            if (timeFilter === "MONTHLY") return diffDays <= 30;
            return true;
        });

        return filtered.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    }, [orders, timeFilter]);

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
                <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/home")}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Geçmiş Siparişlerim</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <View style={styles.filterContainer}>
                {(['ALL', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((filter) => (
                    <TouchableOpacity
                        key={filter}
                        style={[styles.filterBtn, timeFilter === filter && styles.filterBtnActive]}
                        onPress={() => setTimeFilter(filter)}
                    >
                        <Text style={[styles.filterBtnText, timeFilter === filter && styles.filterBtnTextActive]}>
                            {filter === 'ALL' ? 'Tümü' : filter === 'DAILY' ? 'Günlük' : filter === 'WEEKLY' ? 'Haftalık' : 'Aylık'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} title="Yenileniyor..." titleColor={colors.text} colors={[colors.primary]} progressBackgroundColor="#ffffff" progressViewOffset={30} />}
            >
                {sortedOrders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="history" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Henüz geçmiş bir siparişiniz yok.</Text>
                        <TouchableOpacity style={styles.goMenuBtn} onPress={() => router.push("/(tabs)/menu")}>
                            <Text style={styles.goMenuBtnText}>Sipariş Ver</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    sortedOrders.map((order, idx) => {
                        const date = new Date(order.created_at || order.date);
                        const isCompleted = true; // Show evaluate button for all past orders

                        return (
                            <View key={order.id || idx} style={styles.orderCard}>
                                <View style={styles.orderHeader}>
                                    <View style={styles.orderTitleBox}>
                                        <MaterialIcons
                                            name="receipt-long"
                                            size={20}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.orderNumber}>
                                            Sipariş #{order.order_number || String(order.id).substring(0, 6).toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.orderDate}>
                                        {date.toLocaleDateString('tr-TR')} {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                                    </Text>
                                </View>

                                <View style={styles.orderItems}>
                                    {order.adisyon_items && order.adisyon_items.length > 0 ? (
                                        order.adisyon_items.map((item: any) => (
                                            <Text key={item.id} style={styles.orderItemText}>
                                                {item.quantity}x {item.menu_items?.name || 'Yemek'} {!isCompany && `- ₺${item.line_total}`}
                                            </Text>
                                        ))
                                    ) : (
                                        <Text style={styles.orderItemText} numberOfLines={2}>
                                            Satın alım detaylarını restorandan öğrenebilirsiniz.
                                        </Text>
                                    )}
                                    {order.note && <Text style={[styles.orderItemText, { marginTop: 8, fontStyle: 'italic' }]}>Not: {order.note}</Text>}
                                </View>

                                <View style={styles.orderFooter}>
                                    <View style={styles.totalBox}>
                                        <Text style={styles.orderTotalLabel}>Toplam Tutar</Text>
                                        <Text style={styles.orderTotalValue}>{isCompany ? "-" : `₺${order.total_amount || 0}`}</Text>
                                    </View>
                                    {isCompleted && !ratedOrders.includes(order.id) && (
                                        <TouchableOpacity 
                                            style={styles.evaluateBtn} 
                                            onPress={() => handleEvaluate(order.id)}
                                        >
                                            <MaterialIcons name="star-outline" size={16} color="#fff" />
                                            <Text style={styles.evaluateBtnText}>Değerlendir</Text>
                                        </TouchableOpacity>
                                    )}
                                    {isCompleted && ratedOrders.includes(order.id) && (
                                        <View style={[styles.evaluateBtn, { backgroundColor: colors.surfaceBorder }]}>
                                            <MaterialIcons name="check" size={16} color={colors.text} />
                                            <Text style={[styles.evaluateBtnText, { color: colors.text }]}>Değerlendirildi</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
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

    filterContainer: {
        flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 12, justifyContent: 'space-between'
    },
    filterBtn: {
        flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
    },
    filterBtnActive: {
        backgroundColor: colors.primary, borderColor: colors.primary,
    },
    filterBtnText: {
        fontSize: 12, fontWeight: 'bold', color: colors.muted
    },
    filterBtnTextActive: {
        color: '#fff'
    },

    scrollContent: { padding: 24, paddingTop: 8, paddingBottom: 60, flexGrow: 1 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
    emptyText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
    goMenuBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, marginTop: 8 },
    goMenuBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    orderCard: {
        backgroundColor: colors.surface, borderRadius: 24, padding: 20,
        borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    orderTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    orderNumber: { fontSize: 14, fontWeight: '900', color: colors.text },
    orderDate: { fontSize: 11, fontWeight: 'bold', color: colors.muted },

    orderItems: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder },
    orderItemText: { fontSize: 13, color: colors.muted, lineHeight: 20 },

    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontSize: 10, fontWeight: '900' },
    totalBox: { alignItems: 'flex-end' },
    orderTotalLabel: { fontSize: 11, fontWeight: 'bold', color: colors.muted, marginBottom: 2 },
    orderTotalValue: { fontSize: 18, fontWeight: '900', color: colors.text },
    evaluateBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    evaluateBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
