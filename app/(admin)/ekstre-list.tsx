import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EkstreOnizlemeModal from "@/components/EkstreOnizlemeModal";
import Colors from "@/constants/Colors";
import { billingService } from "@/lib/services/billingService";
import { ekstreService } from "@/lib/services/ekstreService";
import { pdfService } from "@/lib/services/pdfService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function EkstreListScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [loading, setLoading] = useState(true);
    const [firms, setFirms] = useState<any[]>([]);
    const [selectedFirma, setSelectedFirma] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [ekstreData, setEkstreData] = useState<any>(null);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState("");

    // ── Ay Kapanışı State ──────────────────────────────────────
    const [closeYear, setCloseYear]   = useState(new Date().getFullYear());
    const [closeMonth, setCloseMonth] = useState(new Date().getMonth() + 1);
    const [closeSummaryModal, setCloseSummaryModal] = useState(false);
    const [closeSummary, setCloseSummary] = useState<{ affectedOrders: number; totalAmount: number; affectedFirms: number } | null>(null);
    const [closeLoading, setCloseLoading] = useState(false);

    useEffect(() => {
        loadFirms();
    }, []);

    const loadFirms = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('balance', { ascending: false });

            if (error) throw error;
            setFirms(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // ── Ay Kapanışı ────────────────────────────────────────────

    const MONTHS = [
        'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
        'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
    ];

    const shiftMonth = (delta: number) => {
        let m = closeMonth + delta;
        let y = closeYear;
        if (m < 1)  { m = 12; y -= 1; }
        if (m > 12) { m = 1;  y += 1; }
        // Sadece gelecek ayı engelle — bu ay (cari ay) kapatılabilir
        const current = new Date();
        if (y > current.getFullYear() || (y === current.getFullYear() && m > current.getMonth() + 1)) return;
        setCloseMonth(m);
        setCloseYear(y);
    };

    const handleCloseMonthPreview = async () => {
        setCloseLoading(true);
        try {
            const endDate   = new Date(closeYear, closeMonth, 0, 23, 59, 59, 999).toISOString();
            const CLOSED = '("PAID","Ödendi","ÖDENDİ","CANCELLED","İptal","COMPLETED","Tamamlandı")';
            const EXCL   = '("MANUAL_PAYMENT","MANUAL_DEBT")';

            // Kurumsal kullanıcıları bul
            const [ownerRes, empRes] = await Promise.all([
                supabase.from("companies").select("user_id").not("user_id", "is", null),
                supabase.from("users").select("id").not("company_id", "is", null),
            ]);
            const corporateUserIds = [
                ...(ownerRes.data || []).map((c) => c.user_id),
                ...(empRes.data  || []).map((u) => u.id),
            ].filter(Boolean);

            let affectedOrders = 0;
            if (corporateUserIds.length > 0) {
                const { data: summary } = await supabase
                    .from('adisyon')
                    .select('id, total_amount, user_id')
                    .lte('created_at', endDate)
                    .in('user_id', corporateUserIds)
                    .not('status', 'in', CLOSED)
                    .not('order_type', 'in', EXCL);
                affectedOrders = summary?.length ?? 0;
            }

            // companies.balance üzerinden hesapla — adisyon toplamı admin RLS'i yüzünden eksik gelebilir
            const { data: compsWithDebt } = await supabase
                .from('companies').select('id, balance').gt('balance', 0);
            const totalAmount   = (compsWithDebt || []).reduce((s: number, c: any) => s + (c.balance || 0), 0);
            const affectedFirms = (compsWithDebt || []).length;

            setCloseSummary({ affectedOrders, totalAmount, affectedFirms });
            setCloseSummaryModal(true);
        } catch (e: any) {
            Alert.alert('Hata', 'Özet hesaplanamadı: ' + (e.message || 'Bilinmeyen hata'));
        } finally {
            setCloseLoading(false);
        }
    };

    const handleCloseMonthConfirm = async () => {
        setCloseSummaryModal(false);
        setCloseLoading(true);
        try {
            const result = await billingService.closeMonthAdmin(closeYear, closeMonth);
            await loadFirms();
            Alert.alert(
                '✅ Ay Kapanışı Tamamlandı',
                `${MONTHS[closeMonth - 1]} ${closeYear}\n\n` +
                `• ${result.affectedFirms} firma\n` +
                `• ${result.affectedOrders} sipariş kapatıldı\n` +
                `• ₺${result.totalAmount.toLocaleString('tr-TR')} tutarında borç sıfırlandı`
            );
        } catch (e: any) {
            Alert.alert('Hata', 'Ay kapanışı tamamlanamadı: ' + (e.message || 'Bilinmeyen hata'));
        } finally {
            setCloseLoading(false);
        }
    };

    const handleCreateEkstre = async (firma: any) => {
        setSelectedFirma(firma);
        setModalVisible(true);
        setEkstreData(null);
        setPdfUri(null);
        setHtmlContent("");

        try {
            // Ayın başından bugüne kadar olan dönemi varsayılan olarak seçiyoruz
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const baslangic = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
            const bitis = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            
            const data = await ekstreService.getEkstreVerisi(firma.id, baslangic, bitis);
            const html = pdfService.generateHesapEkstresi(data);
            
            setEkstreData(data);
            setHtmlContent(html);
            
            // PDF dosyasını arka planda oluştur
            const { uri } = await require('expo-print').printToFileAsync({ html });
            setPdfUri(uri);
        } catch (error) {
            console.error("Ekstre oluşturma hatası:", error);
            setModalVisible(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Firma Ekstre Yönetimi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

                {/* ── AY KAPANIMI PANELİ ────────────────────────── */}
                <View style={styles.closeMonthCard}>
                    <View style={styles.closeMonthHeader}>
                        <MaterialIcons name="event-available" size={22} color="#7c3aed" />
                        <Text style={styles.closeMonthTitle}>Ay Kapanışı</Text>
                    </View>
                    <Text style={styles.closeMonthDesc}>
                        Seçili aya ait tüm firmaların ödenmemiş siparişlerini kapatır ve bakiyeleri sıfırlar.
                    </Text>

                    {/* Ay/Yıl Seçici */}
                    <View style={styles.monthPicker}>
                        <TouchableOpacity style={styles.monthArrow} onPress={() => shiftMonth(-1)}>
                            <MaterialIcons name="chevron-left" size={28} color="#7c3aed" />
                        </TouchableOpacity>
                        <View style={styles.monthLabel}>
                            <Text style={styles.monthLabelText}>{MONTHS[closeMonth - 1]} {closeYear}</Text>
                        </View>
                        <TouchableOpacity style={styles.monthArrow} onPress={() => shiftMonth(1)}>
                            <MaterialIcons name="chevron-right" size={28} color="#7c3aed" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.closeMonthBtn, closeLoading && { opacity: 0.6 }]}
                        onPress={handleCloseMonthPreview}
                        disabled={closeLoading}
                        activeOpacity={0.8}
                    >
                        {closeLoading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <>
                                <MaterialIcons name="lock" size={18} color="#fff" />
                                <Text style={styles.closeMonthBtnText}>Özeti Gör ve Kapat</Text>
                            </>
                        }
                    </TouchableOpacity>
                </View>

                {/* ── FİRMA LİSTESİ ─────────────────────────────── */}
                {firms.map((firma) => {
                    const hasDebt = (firma.balance || 0) > 0;
                    return (
                        <View key={firma.id} style={styles.firmCard}>
                            <View style={styles.firmInfo}>
                                <Text style={styles.firmName}>{firma.company_name}</Text>
                                <Text style={styles.firmMeta}>Son Güncelleme: {firma.last_debt_update ? new Date(firma.last_debt_update).toLocaleDateString('tr-TR') : '-'}</Text>
                            </View>
                            
                            <View style={styles.firmActions}>
                                <View style={[styles.debtBadge, { backgroundColor: hasDebt ? "#fff7ed" : "#f0fdf4", borderColor: hasDebt ? "#fb923c" : "#bbf7d0" }]}>
                                    <Text style={[styles.debtText, { color: hasDebt ? "#ea580c" : "#16803d" }]}>
                                        {hasDebt ? `₺${firma.balance.toLocaleString('tr-TR')} Borç` : 'Borç Yok'}
                                    </Text>
                                </View>
                                
                                <TouchableOpacity 
                                    style={[styles.createBtn, { backgroundColor: colors.primary }]} 
                                    onPress={() => handleCreateEkstre(firma)}
                                >
                                    <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                                    <Text style={styles.createBtnText}>Ekstre Oluştur</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* ── AY KAPANIMI ÖZET MODAL ────────────────────────── */}
            <Modal
                visible={closeSummaryModal}
                transparent
                animationType="fade"
                onRequestClose={() => setCloseSummaryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.summaryModal}>
                        <View style={styles.summaryModalHeader}>
                            <MaterialIcons name="warning" size={28} color="#d97706" />
                            <Text style={styles.summaryModalTitle}>Ay Kapanışı Onayı</Text>
                        </View>

                        <Text style={styles.summaryModalPeriod}>
                            {MONTHS[closeMonth - 1]} {closeYear}
                        </Text>

                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Etkilenecek Firma</Text>
                            <Text style={styles.summaryValue}>{closeSummary?.affectedFirms ?? 0}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Kapatılacak Sipariş</Text>
                            <Text style={styles.summaryValue}>{closeSummary?.affectedOrders ?? 0}</Text>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 8, paddingTop: 12 }]}>
                            <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: '#dc2626' }]}>Sıfırlanacak Tutar</Text>
                            <Text style={[styles.summaryValue, { color: '#dc2626', fontWeight: '900' }]}>
                                ₺{(closeSummary?.totalAmount ?? 0).toLocaleString('tr-TR')}
                            </Text>
                        </View>

                        <Text style={styles.summaryWarning}>
                            ⚠️ Bu işlem geri alınamaz. MANUEL borç/ödeme kayıtlarına dokunulmaz.
                        </Text>

                        <View style={styles.summaryButtons}>
                            <TouchableOpacity
                                style={styles.summaryBtnCancel}
                                onPress={() => setCloseSummaryModal(false)}
                            >
                                <Text style={styles.summaryBtnCancelText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.summaryBtnConfirm}
                                onPress={handleCloseMonthConfirm}
                            >
                                <MaterialIcons name="lock" size={16} color="#fff" />
                                <Text style={styles.summaryBtnConfirmText}>Onayla ve Kapat</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {modalVisible && (
                <EkstreOnizlemeModal 
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    pdfUri={pdfUri}
                    htmlContent={htmlContent}
                    firmaAdi={selectedFirma?.company_name || ""}
                    donemBilgisi={ekstreData ? `${new Date(ekstreData.donem.baslangic).toLocaleDateString('tr-TR')} - ${new Date(ekstreData.donem.bitis).toLocaleDateString('tr-TR')}` : "Hazırlanıyor..."}
                />
            )}
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.surface,
        borderBottomWidth:1,
        borderBottomColor: colors.surfaceBorder
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    list: { padding: 20, paddingBottom: 40 },
    firmCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    firmInfo: { marginBottom: 15 },
    firmName: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 4 },
    firmMeta: { fontSize: 12, color: colors.muted },
    firmActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debtBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    debtText: { fontSize: 14, fontWeight: 'bold' },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8
    },
    createBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

    // ── Ay Kapanışı ──────────────────────────────────────────────
    closeMonthCard: {
        backgroundColor: '#f5f3ff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1.5,
        borderColor: '#c4b5fd',
    },
    closeMonthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    closeMonthTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#5b21b6',
    },
    closeMonthDesc: {
        fontSize: 13,
        color: '#6d28d9',
        marginBottom: 16,
        lineHeight: 18,
    },
    monthPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 8,
    },
    monthArrow: {
        padding: 4,
    },
    monthLabel: {
        backgroundColor: '#ede9fe',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
        minWidth: 160,
        alignItems: 'center',
    },
    monthLabelText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#5b21b6',
    },
    closeMonthBtn: {
        backgroundColor: '#7c3aed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    closeMonthBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },

    // ── Özet Modal ───────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    summaryModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
    },
    summaryModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    summaryModalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1e293b',
    },
    summaryModalPeriod: {
        fontSize: 15,
        color: '#64748b',
        marginBottom: 20,
        marginLeft: 38,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#475569',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    summaryWarning: {
        fontSize: 12,
        color: '#b45309',
        backgroundColor: '#fef3c7',
        borderRadius: 8,
        padding: 10,
        marginTop: 16,
        lineHeight: 18,
    },
    summaryButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    summaryBtnCancel: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    summaryBtnCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
    },
    summaryBtnConfirm: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dc2626',
        flexDirection: 'row',
        gap: 8,
    },
    summaryBtnConfirmText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
    },
});
