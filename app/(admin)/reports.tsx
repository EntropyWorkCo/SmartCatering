import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminReports() {
    const { orders } = useAdisyon();
    const insets = useSafeAreaInsets();
    const [view, setView] = useState<"MAIN" | "SALES" | "STATS" | "FEEDBACK">(
        "MAIN"
    );

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    // Mock Ratings
    const mockRatings = [
        { id: '1', userName: 'Sena Arslan', company: 'Tech A.Ş.', generalStars: 5, note: 'Yemekler harikaydı, elinize sağlık.', date: '25.10.2023' },
        { id: '2', userName: 'Ahmet Yılmaz', company: '', generalStars: 4, note: 'Çorba biraz soğuktu ama lezzetliydi.', date: '24.10.2023' },
    ];

    if (view === "SALES")
        return <DailySalesView onBack={() => setView("MAIN")} orders={orders} colors={colors} styles={styles} />;
    if (view === "STATS")
        return <PerformanceDashboard onBack={() => setView("MAIN")} ratings={mockRatings} colors={colors} styles={styles} />;
    if (view === "FEEDBACK")
        return <FeedbackView onBack={() => setView("MAIN")} ratings={mockRatings} colors={colors} styles={styles} />;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Raporlar & Analiz</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <Text style={styles.sectionHeader}>SİSTEM ÖZETLERİ</Text>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.menuContainer}>
                    <ReportMenuItem
                        icon="insights"
                        label="Günlük Satış Özeti"
                        subtitle="Günün toplam cirosu ve menü dağılımı."
                        onClick={() => setView("SALES")}
                        colors={colors}
                        styles={styles}
                    />
                    <ReportMenuItem
                        icon="star"
                        label="Müşteri Geri Bildirimleri"
                        subtitle="Gerçek zamanlı puanlar ve yorumlar."
                        onClick={() => setView("FEEDBACK")}
                        colors={colors}
                        styles={styles}
                    />
                    <ReportMenuItem
                        icon="query-stats"
                        label="Performans Analizi"
                        subtitle="Mutfak başarısı ve kategori skorları."
                        onClick={() => setView("STATS")}
                        isLast
                        colors={colors}
                        styles={styles}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const ReportMenuItem = ({ icon, label, subtitle, onClick, isLast, colors, styles }: any) => (
    <TouchableOpacity
        style={[styles.menuItem, !isLast && styles.menuItemBorder]}
        onPress={onClick}
        activeOpacity={0.7}
    >
        <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIcon}>
                <MaterialIcons name={icon} size={24} color={colors.primary} />
            </View>
            <View>
                <Text style={styles.menuItemLabel}>{label}</Text>
                <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
            </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </TouchableOpacity>
);

const DailySalesView = ({ onBack, orders, colors, styles }: any) => {
    const insets = useSafeAreaInsets();

    const stats = useMemo(() => {
        const revenue = orders.reduce((acc: number, curr: any) => acc + (curr.total_amount || 0), 0);
        const count = orders.length;
        return { revenue, count, orders };
    }, [orders]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Günlük Satış Özeti</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: colors.infoBg, borderColor: colors.info }]}>
                        <Text style={[styles.statBoxLabel, { color: colors.info }]}>GÜNLÜK GELİR</Text>
                        <Text style={styles.statBoxValue}>₺{stats.revenue.toLocaleString("tr-TR")}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.cardHighlight, borderColor: colors.primary }]}>
                        <Text style={[styles.statBoxLabel, { color: colors.primary }]}>ÖĞÜN SAYISI</Text>
                        <Text style={styles.statBoxValue}>{stats.count} Adet</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>BUGÜNKÜ İŞLEMLER</Text>

                {stats.orders.length > 0 ? (
                    stats.orders.map((o: any) => (
                        <View key={o.id} style={styles.orderCard}>
                            <View>
                                <Text style={styles.orderName}>{o.userName || 'Müşteri'}</Text>
                                <Text style={styles.orderIdLabel}>Sipariş #{String(o.id).substring(0, 8)}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                                <Text style={styles.orderTotal}>₺{o.total_amount?.toLocaleString("tr-TR")}</Text>
                                <Text style={styles.orderTime}>{o.status}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="trending-flat" size={48} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Veri bulunmuyor</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const PerformanceDashboard = ({ onBack, ratings, colors, styles }: any) => {
    const insets = useSafeAreaInsets();
    const stats = { general: "4.8", ana: "4.6", corba: "4.9", yan: "4.5", tatli: "4.7" };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Performans Analizi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.perfHeroCard}>
                    <MaterialIcons name="analytics" size={100} color="rgba(255,255,255,0.05)" style={styles.perfHeroIcon} />
                    <View style={styles.perfHeroContent}>
                        <View>
                            <Text style={styles.perfHeroLabel}>GENEL PUAN ORTALAMASI</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={styles.perfHeroScore}>{stats.general}</Text>
                                <Text style={styles.perfHeroScoreMax}>/ 5.0</Text>
                            </View>
                            <Text style={styles.perfHeroDesc}>Sistemdeki tüm oyların ortalamasıdır</Text>
                        </View>
                        <View style={styles.perfHeroBadge}>
                            <MaterialIcons name="verified" size={40} color={colors.primary} />
                        </View>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <StatCard icon="restaurant" label="ANA YEMEK" score={stats.ana} color="#f97316" trend="+0.2" styles={styles} />
                    <StatCard icon="soup-kitchen" label="ÇORBALAR" score={stats.corba} color="#3b82f6" trend="-0.1" styles={styles} />
                    <StatCard icon="flatware" label="YAN YEMEK" score={stats.yan} color="#10b981" trend="+0.5" styles={styles} />
                    <StatCard icon="cake" label="TATLI" score={stats.tatli} color="#ec4899" trend="0.0" styles={styles} />
                </View>
            </ScrollView>
        </View>
    );
};

const StatCard = ({ icon, label, score, color, trend, styles }: any) => (
    <View style={styles.smallStatCard}>
        <View style={[styles.smallStatIconCont, { backgroundColor: `${color}15` }]}>
            <MaterialIcons name={icon} size={28} color={color} />
        </View>
        <Text style={styles.smallStatLabel}>{label}</Text>
        <View style={styles.smallStatBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.smallStatScore}>{score}</Text>
                <Text style={styles.smallStatScoreMax}> / 5</Text>
            </View>
            <Text style={[styles.smallStatTrend, { color: parseFloat(trend) >= 0 ? '#10b981' : '#ef4444' }]}>
                {trend}
            </Text>
        </View>
    </View>
);

const FeedbackView = ({ onBack, ratings, colors, styles }: any) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Müşteri Yorumları</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {ratings.length > 0 ? (
                    ratings.map((r: any) => (
                        <View key={r.id} style={styles.feedbackCard}>
                            <View style={styles.feedbackTop}>
                                <View style={styles.feedbackUser}>
                                    <View style={styles.feedbackAvatar}>
                                        <MaterialIcons name="person" size={20} color={colors.text} />
                                    </View>
                                    <View>
                                        <Text style={styles.feedbackName}>{r.userName}</Text>
                                        <Text style={styles.feedbackCompany}>{r.company || 'Bireysel'}</Text>
                                    </View>
                                </View>
                                <View style={styles.starsCont}>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <MaterialIcons key={i} name="star" size={16} color={i <= r.generalStars ? "#fbbf24" : colors.surfaceBorder} />
                                    ))}
                                </View>
                            </View>
                            <Text style={styles.feedbackNote}>"{r.note}"</Text>
                            <Text style={styles.feedbackDate}>{r.date}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="rate-review" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Henüz yorum yok</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    )
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder, marginRight: 16 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    sectionHeader: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginLeft: 24, marginBottom: 12, marginTop: 8 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    menuContainer: { backgroundColor: colors.surface, borderRadius: 32, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: "hidden" },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24 },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
    menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    menuItemIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.cardHighlight, alignItems: "center", justifyContent: "center", marginRight: 16 },
    menuItemLabel: { fontSize: 16, fontWeight: "900", color: colors.text, marginBottom: 4 },
    menuItemSubtitle: { fontSize: 11, fontWeight: "bold", color: colors.muted },

    // Sales View
    statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: 'wrap' },
    statBox: { flex: 1, padding: 20, borderRadius: 24, borderWidth: 1 },
    statBoxLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
    statBoxValue: { fontSize: 24, fontWeight: "900", color: colors.text },
    orderCard: { backgroundColor: colors.surface, padding: 20, borderRadius: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 12 },
    orderName: { fontSize: 14, fontWeight: "bold", color: colors.text, marginBottom: 4 },
    orderIdLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
    orderTotal: { fontSize: 16, fontWeight: "900", color: colors.text },
    orderTime: { fontSize: 10, fontWeight: "bold", color: colors.muted, textTransform: "uppercase", marginTop: 4 },
    emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
    emptyText: { marginTop: 16, fontSize: 12, fontWeight: "900", color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },

    // Perf View
    perfHeroCard: { backgroundColor: colors.text, borderRadius: 32, padding: 28, marginBottom: 24, overflow: "hidden", position: "relative" },
    perfHeroIcon: { position: "absolute", right: 10, top: 10 },
    perfHeroContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 10 },
    perfHeroLabel: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
    perfHeroScore: { color: colors.background, fontSize: 40, fontWeight: "900" },
    perfHeroScoreMax: { color: colors.muted, fontSize: 14, fontWeight: "bold", marginLeft: 4 },
    perfHeroDesc: { color: colors.background, fontSize: 10, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
    perfHeroBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.cardHighlight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.primary },

    smallStatCard: { width: "47%", backgroundColor: colors.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16 },
    smallStatIconCont: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    smallStatLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
    smallStatBottom: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    smallStatScore: { fontSize: 24, fontWeight: "900", color: colors.text },
    smallStatScoreMax: { fontSize: 12, fontWeight: "900", color: colors.muted },
    smallStatTrend: { fontSize: 10, fontWeight: "900" },

    // Feedback View
    feedbackCard: { backgroundColor: colors.surface, padding: 24, borderRadius: 32, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16 },
    feedbackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    feedbackUser: { flexDirection: "row", alignItems: "center", gap: 12 },
    feedbackAvatar: { width: 40, height: 40, borderRadius: 16, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    feedbackName: { fontSize: 14, fontWeight: "900", color: colors.text, marginBottom: 2 },
    feedbackCompany: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
    starsCont: { flexDirection: "row", gap: 2 },
    feedbackNote: { fontSize: 14, color: colors.text, fontWeight: "500", fontStyle: "italic", lineHeight: 22, marginBottom: 16 },
    feedbackDate: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }
});
