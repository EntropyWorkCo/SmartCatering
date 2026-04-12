import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EkstreOnizlemeModal from "@/components/EkstreOnizlemeModal";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { ekstreService } from "@/lib/services/ekstreService";
import { pdfService } from "@/lib/services/pdfService";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function FirmaSahibiEkstreScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile } = useProfile(user?.id);

    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<any>(null);
    const [monthlySummary, setMonthlySummary] = useState<any>(null);
    
    const [modalVisible, setModalVisible] = useState(false);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState("");

    const actualCompanyId = profile?.corporate_info?.id || profile?.company_id;

    useEffect(() => {
        generateMonthList();
    }, []);

    useEffect(() => {
        if (selectedMonth && actualCompanyId) {
            loadMonthlySummary();
        }
    }, [selectedMonth, actualCompanyId]);

    const generateMonthList = () => {
        const list = [];
        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const now = new Date();
        
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            list.push({
                label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                startDate: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0],
                endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
            });
        }
        setMonths(list);
        setSelectedMonth(list[0]);
    };

    const loadMonthlySummary = async () => {
        if (!actualCompanyId || !selectedMonth) return;
        setLoading(true);
        try {
            const data = await ekstreService.getEkstreVerisi(actualCompanyId, selectedMonth.startDate, selectedMonth.endDate);
            setMonthlySummary(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewEkstre = async () => {
        if (!monthlySummary) return;
        setModalVisible(true);
        setPdfUri(null);
        setHtmlContent("");

        try {
            const html = pdfService.generateEkstreHTML(monthlySummary);
            setHtmlContent(html);
            
            const { uri } = await require('expo-print').printToFileAsync({ html });
            setPdfUri(uri);
        } catch (error) {
            console.error("Ekstre görüntüleme hatası:", error);
            setModalVisible(false);
        }
    };

    const statusInfo = useMemo(() => {
        if (!monthlySummary) return null;
        // Seçilen aya ait borç kaydını bul
        const currentDebt = monthlySummary.borclar.find((b: any) => b.ay === selectedMonth.month && b.yil === selectedMonth.year);
        if (!currentDebt) return { label: 'KAYIT YOK', color: colors.muted, bg: colors.surface };

        if (currentDebt.durum === 'ÖDENDİ') return { label: 'ÖDENDİ', color: '#16a34a', bg: '#f0fdf4' };
        if (currentDebt.durum === 'TAMAMLANDI') return { label: 'TAMAMLANDI', color: '#2563eb', bg: '#eff6ff' };
        return { label: 'BEKLİYOR', color: '#f59e0b', bg: '#fffbeb' };
    }, [monthlySummary, selectedMonth, colors]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Ekstrelerim</Text>
            </View>

            {/* Ay Seçici (Yatay Scroll) */}
            <View style={styles.monthSelector}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {months.map((m, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            style={[styles.monthBtn, selectedMonth?.label === m.label && styles.monthBtnActive]}
                            onPress={() => setSelectedMonth(m)}
                        >
                            <Text style={[styles.monthText, selectedMonth?.label === m.label && styles.monthTextActive]}>{m.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : monthlySummary ? (
                    <View style={{ gap: 20 }}>
                        {/* Summary Card */}
                        <View style={[styles.card, { borderLeftColor: statusInfo?.color, borderLeftWidth: 6 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardPeriod}>{selectedMonth.label}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: statusInfo?.bg }]}>
                                    <Text style={[styles.statusText, { color: statusInfo?.color }]}>{statusInfo?.label}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.statsRow}>
                                <View>
                                    <Text style={styles.statLabel}>Toplam Yemek</Text>
                                    <Text style={styles.statValue}>{monthlySummary.toplamYemekSayisi} porsiyon</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.statLabel}>Aylık Tutar</Text>
                                    <Text style={styles.statValue}>₺{monthlySummary.yemekGenelToplam.toLocaleString('tr-TR')}</Text>
                                </View>
                            </View>

                            <View style={styles.statsRow}>
                                <View>
                                    <Text style={styles.statLabel}>Geçmiş Borç</Text>
                                    <Text style={styles.statValue}>₺{(monthlySummary.toplamBorc - monthlySummary.yemekGenelToplam).toLocaleString('tr-TR')}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.statLabel}>Ödenen</Text>
                                    <Text style={[styles.statValue, { color: '#16a34a' }]}>₺{monthlySummary.toplamOdenen.toLocaleString('tr-TR')}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.statsRow}>
                                <Text style={[styles.statLabel, { fontSize: 16, color: colors.text }]}>KALAN BORÇ</Text>
                                <Text style={[styles.statValue, { fontSize: 20, color: colors.danger }]}>₺{monthlySummary.kalanBorc.toLocaleString('tr-TR')}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={[styles.viewBtn, { backgroundColor: colors.primary }]} onPress={handleViewEkstre}>
                            <MaterialIcons name="picture-as-pdf" size={24} color="#fff" />
                            <Text style={styles.viewBtnText}>Ekstremi Görüntüle</Text>
                        </TouchableOpacity>

                        <View style={styles.infoBox}>
                            <MaterialIcons name="info-outline" size={20} color={colors.muted} />
                            <Text style={styles.infoText}>
                                Ekstre detayı yemek_kayitlari tablosundan anlık olarak çekilmektedir. Ödemeleriniz sisteme işlendiğinde "ÖDENDİ" statüsüne geçer.
                            </Text>
                        </View>

                        <TouchableOpacity 
                            style={[styles.viewBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, marginTop: 12 }]} 
                            onPress={() => router.push("/corporate-info")}
                        >
                            <MaterialIcons name="group-add" size={24} color={colors.primary} />
                            <Text style={[styles.viewBtnText, { color: colors.primary }]}>Çalışan Ekle & Firma Yönetimi</Text>
                        </TouchableOpacity>
                    </View>

                ) : (
                    <View style={styles.center}>
                        <Text style={{ color: colors.muted }}>Veri bulunamadı.</Text>
                    </View>
                )}
            </ScrollView>

            {modalVisible && (
                <EkstreOnizlemeModal 
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    pdfUri={pdfUri}
                    htmlContent={htmlContent}
                    firmaAdi={profile?.corporate_info?.companyName || profile?.company_name || "Firmam"}
                    donemBilgisi={selectedMonth?.label || ""}
                />
            )}
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backBtn: { padding: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    monthSelector: { paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
    monthBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder },
    monthBtnActive: { backgroundColor: "#1a2e4a", borderColor: "#1a2e4a" },
    monthText: { fontSize: 13, fontWeight: '900', color: colors.muted },
    monthTextActive: { color: "#fff" },
    content: { padding: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    cardPeriod: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '900' },
    divider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 15 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
    statValue: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    viewBtn: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    viewBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    infoBox: { flexDirection: 'row', gap: 10, padding: 10 },
    infoText: { flex: 1, fontSize: 11, color: colors.muted, lineHeight: 16 }
});
