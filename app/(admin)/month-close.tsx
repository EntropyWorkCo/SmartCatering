/**
 * month-close.tsx — Admin: Ay Kapanışı Paneli
 *
 * Modlar:
 *  1. Toplu kapanış  — seçilen ayın TÜM firmalarını kapatır
 *  2. Tekil kapanış  — belirli bir firmayı seçerek kapatır
 *
 * Güvenlik:
 *  - MANUAL_DEBT / MANUAL_PAYMENT kayıtlarına dokunulmaz
 *  - Sadece PAID/Ödendi/CANCELLED/İptal/COMPLETED olmayan siparişler etkilenir
 *  - Silme yok — sadece status güncellemesi
 */

import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { billingService } from "@/lib/services/billingService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

// ── Sabitler ────────────────────────────────────────────────────────────────
const MONTHS = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

const CLOSED_STATUSES = '("PAID","Ödendi","ÖDENDİ","CANCELLED","İptal")';
const EXCLUDED_TYPES  = '("MANUAL_PAYMENT","MANUAL_DEBT")';

// ── Yardımcı: Önizleme sorgula ──────────────────────────────────────────────
async function fetchPreview(year: number, month: number, companyId?: string) {
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    let q = supabase
        .from("adisyon")
        .select("id, total_amount, user_id")
        .lte("created_at", endDate)
        .not("status", "in", CLOSED_STATUSES)
        .not("order_type", "in", EXCLUDED_TYPES);

    let ids: string[] = [];
    if (companyId) {
        const { data: empRows } = await supabase.from("users").select("id").eq("company_id", companyId);
        const { data: ownerRow } = await supabase.from("companies").select("user_id").eq("id", companyId).maybeSingle();
        ids = [...(empRows || []).map((e: any) => e.id), ownerRow?.user_id].filter(Boolean);
        if (ids.length > 0) {
            q = q.in("user_id", ids);
        } else {
            return { affectedOrders: 0, totalAmount: 0, affectedFirms: 0 };
        }
    } else {
        // Toplu modda sadece kurumsal kullanıcılar
        const [ownerRes, empRes] = await Promise.all([
            supabase.from("companies").select("user_id").not("user_id", "is", null),
            supabase.from("users").select("id").not("company_id", "is", null),
        ]);
        const corporateUserIds = [
            ...(ownerRes.data || []).map((c: any) => c.user_id),
            ...(empRes.data  || []).map((u: any) => u.id),
        ].filter(Boolean);
        
        if (corporateUserIds.length > 0) {
            q = q.in("user_id", corporateUserIds);
        } else {
            return { affectedOrders: 0, totalAmount: 0, affectedFirms: 0 };
        }
    }

    const { data: summary } = await q;
    const affectedOrders = summary?.length ?? 0;

    // “Sıfırlanacak tutar” = gerçek companies.balance (MANUAL_DEBT dahil herşeyi kapsar)
    let totalAmount = 0;
    let affectedFirms = 0;

    if (!companyId) {
        // Toplu: balance'i sıfırın üzerinde olan TÜM firmalar
        const { data: compsWithDebt } = await supabase
            .from("companies").select("id, balance").gt("balance", 0);
        totalAmount   = (compsWithDebt || []).reduce((s: number, c: any) => s + (c.balance || 0), 0);
        affectedFirms = (compsWithDebt || []).length;
        // Adisyon'dan gelen ama bakiyesi 0 gözükmeyen firmalar için union
        if ((summary || []).length > 0) {
            const uniqueUserIds = [...new Set((summary || []).map((o: any) => o.user_id))];
            if (uniqueUserIds.length > 0) {
                const [ownerResFiltered, empResFiltered] = await Promise.all([
                    supabase.from("companies").select("id, balance").in("user_id", uniqueUserIds),
                    supabase.from("users").select("company_id").in("id", uniqueUserIds).not("company_id", "is", null),
                ]);
                const extraIds = new Set([
                    ...(ownerResFiltered.data || []).map((c: any) => c.id),
                    ...(empResFiltered.data || []).filter((u: any) => u.company_id).map((u: any) => u.company_id),
                ]);
                // Zaten sayılmayan firmaları ekle
                const existingComps = new Set((compsWithDebt || []).map((c: any) => c.id));
                extraIds.forEach(id => { if (!existingComps.has(id)) affectedFirms++; });
            }
        }
    } else {
        // Tekil: firmaın gerçek balance'ı
        const { data: comp } = await supabase.from("companies").select("balance").eq("id", companyId).maybeSingle();
        totalAmount   = comp?.balance || 0;
        affectedFirms = 1;
    }

    return { affectedOrders, totalAmount, affectedFirms };
}

// ── Yardımcı: Tekil firma kapat ─────────────────────────────────────────────
async function closeSingleFirm(year: number, month: number, companyId: string) {
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const { data: empRows } = await supabase.from("users").select("id").eq("company_id", companyId);
    const { data: ownerRow } = await supabase.from("companies").select("user_id, balance").eq("id", companyId).maybeSingle();
    const ids = [...(empRows || []).map((e: any) => e.id), ownerRow?.user_id].filter(Boolean);

    // Gerçek balance (MANUAL_DEBT dahil herşeyi kapsar)
    const actualBalance = ownerRow?.balance || 0;

    let affectedOrders = 0;
    if (ids.length > 0) {
        const { data: summary } = await supabase
            .from("adisyon").select("id, total_amount")
            .lte("created_at", endDate)
            .in("user_id", ids)
            .not("status", "in", CLOSED_STATUSES).not("order_type", "in", EXCLUDED_TYPES);
        affectedOrders = summary?.length ?? 0;

        if (affectedOrders > 0) {
            await supabase.from("adisyon")
                .update({ status: "PAID", paid_at: new Date().toISOString() })
                .lte("created_at", endDate)
                .in("user_id", ids)
                .not("status", "in", CLOSED_STATUSES).not("order_type", "in", EXCLUDED_TYPES);
        }
    }

    // Her zaman balance'i sıfırla (adisyon kaydı olmasa bile)
    await supabase.from("companies")
        .update({ balance: 0, last_debt_update: new Date().toISOString() })
        .eq("id", companyId);

    return { affectedOrders, totalAmount: actualBalance };
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function MonthCloseScreen() {
    const router = useRouter();
    const theme  = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    // Ay/Yıl seçici — default: bu ay (en güncel borçlar burada)
    const now = new Date();
    const [selYear,  setSelYear]  = useState(now.getFullYear());
    const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

    // Mod: toplu vs tekil
    const [mode, setMode] = useState<"BULK" | "SINGLE">("BULK");

    // Firmalar listesi (tekil mod için)
    const [firms, setFirms] = useState<any[]>([]);
    const [firmsLoading, setFirmsLoading] = useState(false);
    const [selectedFirm, setSelectedFirm] = useState<any>(null);

    // Önizleme modal
    const [previewModal, setPreviewModal] = useState(false);
    const [preview, setPreview] = useState<{ affectedOrders: number; totalAmount: number; affectedFirms: number } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [closing, setClosing] = useState(false);

    // Firmalar yükle / yenile
    const loadFirms = async () => {
        setFirmsLoading(true);
        const { data } = await supabase
            .from("companies")
            .select("id, company_name, balance")
            .order("company_name");
        setFirms(data || []);
        setFirmsLoading(false);
    };

    useEffect(() => {
        if (mode !== "SINGLE") return;
        loadFirms();
    }, [mode]);

    // Ay kaydır
    const shiftMonth = (delta: number) => {
        let m = selMonth + delta;
        let y = selYear;
        if (m < 1)  { m = 12; y--; }
        if (m > 12) { m = 1;  y++; }
        const current = new Date();
        // Sadece gelecek ayı engelle — bu ay (cari ay) kapatılabilir
        if (y > current.getFullYear() || (y === current.getFullYear() && m > current.getMonth() + 1)) return;
        setSelMonth(m);
        setSelYear(y);
    };

    // Önizleme göster
    const handlePreview = async () => {
        if (mode === "SINGLE" && !selectedFirm) {
            Alert.alert("Uyarı", "Lütfen bir firma seçin.");
            return;
        }
        setPreviewLoading(true);
        try {
            const data = await fetchPreview(selYear, selMonth, mode === "SINGLE" ? selectedFirm?.id : undefined);
            setPreview(data);
            setPreviewModal(true);
        } catch (e: any) {
            Alert.alert("Hata", e.message || "Önizleme yüklenemedi.");
        } finally {
            setPreviewLoading(false);
        }
    };

    // Kapat
    const handleConfirm = async () => {
        setPreviewModal(false);
        setClosing(true);
        try {
            let result: any;
            if (mode === "BULK") {
                result = await billingService.closeMonthAdmin(selYear, selMonth);
            } else {
                const r = await closeSingleFirm(selYear, selMonth, selectedFirm.id);
                result = { affectedOrders: r.affectedOrders, totalAmount: r.totalAmount, affectedFirms: 1 };
            }
            // Kapatılan firmaların balance'larını anlık yansit
            await loadFirms();
            Alert.alert(
                "✅ Ay Kapanışı Tamamlandı",
                `${MONTHS[selMonth - 1]} ${selYear}\n\n` +
                (mode === "BULK"
                    ? `• ${result.affectedFirms} firma\n`
                    : `• ${selectedFirm?.company_name}\n`) +
                `• ${result.affectedOrders} sipariş kapatıldı\n` +
                `• ₺${result.totalAmount.toLocaleString("tr-TR")} borç sıfırlandı`,
                [{ text: "Tamam", onPress: () => setSelectedFirm(null) }]
            );
        } catch (e: any) {
            Alert.alert("Hata", "Kapanış tamamlanamadı: " + (e.message || "Bilinmeyen hata"));
        } finally {
            setClosing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Ay Kapanışı</Text>
                    <Text style={styles.subtitle}>Borçları kapat, bakiyeleri sıfırla</Text>
                </View>
                <MaterialIcons name="lock-clock" size={28} color="#7c3aed" />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* ── Mod Seçici ─────────────────────────────────────── */}
                <View style={styles.modeToggle}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === "BULK" && styles.modeBtnActive]}
                        onPress={() => { setMode("BULK"); setSelectedFirm(null); }}
                    >
                        <MaterialIcons name="domain" size={18} color={mode === "BULK" ? "#fff" : colors.muted} />
                        <Text style={[styles.modeBtnText, mode === "BULK" && styles.modeBtnTextActive]}>
                            Toplu Kapanış
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === "SINGLE" && styles.modeBtnActive]}
                        onPress={() => setMode("SINGLE")}
                    >
                        <MaterialIcons name="business" size={18} color={mode === "SINGLE" ? "#fff" : colors.muted} />
                        <Text style={[styles.modeBtnText, mode === "SINGLE" && styles.modeBtnTextActive]}>
                            Firma Seçerek
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── Ay / Yıl Seçici ────────────────────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📅 Dönem Seç</Text>
                    <View style={styles.monthPicker}>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftMonth(-1)}>
                            <MaterialIcons name="chevron-left" size={32} color="#7c3aed" />
                        </TouchableOpacity>
                        <View style={styles.monthDisplay}>
                            <Text style={styles.monthText}>{MONTHS[selMonth - 1]}</Text>
                            <Text style={styles.yearText}>{selYear}</Text>
                        </View>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftMonth(1)}>
                            <MaterialIcons name="chevron-right" size={32} color="#7c3aed" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Tekil Mod: Firma Listesi ────────────────────────── */}
                {mode === "SINGLE" && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>🏢 Firma Seç</Text>
                        {firmsLoading ? (
                            <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />
                        ) : firms.length === 0 ? (
                            <Text style={{ color: colors.muted, textAlign: "center", marginVertical: 16 }}>
                                Kayıtlı firma bulunamadı.
                            </Text>
                        ) : (
                            firms.map((firm) => {
                                const isSelected = selectedFirm?.id === firm.id;
                                const hasDebt = (firm.balance || 0) > 0;
                                return (
                                    <TouchableOpacity
                                        key={firm.id}
                                        style={[styles.firmRow, isSelected && styles.firmRowSelected]}
                                        onPress={() => setSelectedFirm(isSelected ? null : firm)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.firmName, isSelected && { color: "#7c3aed" }]}>
                                                {firm.company_name}
                                            </Text>
                                            <Text style={[styles.firmDebt, { color: hasDebt ? "#dc2626" : "#16803d" }]}>
                                                {hasDebt ? `₺${firm.balance.toLocaleString("tr-TR")} borç` : "Borç yok"}
                                            </Text>
                                        </View>
                                        <View style={[styles.firmCheck, isSelected && styles.firmCheckActive]}>
                                            {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                )}

                {/* ── Açıklama Kutusu ─────────────────────────────────── */}
                <View style={styles.infoBox}>
                    <MaterialIcons name="info-outline" size={18} color="#6d28d9" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoText}>
                            {mode === "BULK"
                                ? `${MONTHS[selMonth - 1]} ${selYear} dönemindeki TÜM firmalar için ödenmemiş siparişler PAID yapılır, bakiyeler sıfırlanır.`
                                : selectedFirm
                                    ? `"${selectedFirm.company_name}" firması için ${MONTHS[selMonth - 1]} ${selYear} dönemi kapatılacak.`
                                    : "Yukarıdan kapatılacak firmayı seçin."}
                        </Text>
                        <Text style={styles.infoSubText}>
                            Manuel borç / ödeme kayıtlarına dokunulmaz. Bu işlem geri alınamaz.
                        </Text>
                    </View>
                </View>

                {/* ── Özeti Gör Butonu ────────────────────────────────── */}
                <TouchableOpacity
                    style={[styles.previewBtn, (previewLoading || closing) && { opacity: 0.6 }]}
                    onPress={handlePreview}
                    disabled={previewLoading || closing}
                    activeOpacity={0.8}
                >
                    {previewLoading || closing ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <MaterialIcons name="preview" size={20} color="#fff" />
                            <Text style={styles.previewBtnText}>Özeti Gör ve Kapat</Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>

            {/* ── Onay Modalı ─────────────────────────────────────────── */}
            <Modal visible={previewModal} transparent animationType="slide" onRequestClose={() => setPreviewModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        {/* Tutamaç */}
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeaderRow}>
                            <MaterialIcons name="warning-amber" size={28} color="#d97706" />
                            <Text style={styles.modalTitle}>Ay Kapanışı Onayı</Text>
                        </View>

                        <Text style={styles.modalPeriod}>
                            {mode === "BULK" ? "Tüm Firmalar" : selectedFirm?.company_name} — {MONTHS[selMonth - 1]} {selYear}
                        </Text>

                        {/* Özet Satırları */}
                        <View style={styles.summaryTable}>
                            {mode === "BULK" && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Etkilenecek Firma</Text>
                                    <Text style={styles.summaryVal}>{preview?.affectedFirms ?? 0}</Text>
                                </View>
                            )}
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Kapatılacak Sipariş</Text>
                                <Text style={styles.summaryVal}>{preview?.affectedOrders ?? 0}</Text>
                            </View>
                            <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                                <Text style={[styles.summaryLabel, { color: "#dc2626", fontWeight: "bold" }]}>
                                    Sıfırlanacak Tutar
                                </Text>
                                <Text style={[styles.summaryVal, { color: "#dc2626", fontSize: 20, fontWeight: "900" }]}>
                                    ₺{(preview?.totalAmount ?? 0).toLocaleString("tr-TR")}
                                </Text>
                            </View>
                        </View>

                        {preview?.affectedOrders === 0 && (
                            <View style={styles.noDebtBanner}>
                                <MaterialIcons name="check-circle" size={20} color="#16803d" />
                                <Text style={{ color: "#16803d", fontWeight: "bold", marginLeft: 8 }}>
                                    Bu dönemde kapatılacak sipariş yok.
                                </Text>
                            </View>
                        )}

                        <Text style={styles.warningText}>
                            ⚠️ Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                        </Text>

                        <View style={styles.modalBtns}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setPreviewModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, (preview?.affectedOrders === 0 && (preview?.totalAmount ?? 0) === 0) && { opacity: 0.4 }]}
                                onPress={(preview?.affectedOrders === 0 && (preview?.totalAmount ?? 0) === 0) ? undefined : handleConfirm}
                                disabled={(preview?.affectedOrders ?? 0) === 0 && (preview?.totalAmount ?? 0) === 0}
                            >
                                <MaterialIcons name="lock" size={16} color="#fff" />
                                <Text style={styles.confirmBtnText}>Onayla ve Kapat</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ── Stiller ──────────────────────────────────────────────────────────────────
const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 20, paddingVertical: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder,
        gap: 12,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "900", color: colors.text },
    subtitle: { fontSize: 11, color: colors.muted },
    scroll: { padding: 20, paddingBottom: 60, gap: 16 },

    // Mod toggle
    modeToggle: {
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: 14, padding: 4,
        borderWidth: 1, borderColor: colors.surfaceBorder,
    },
    modeBtn: {
        flex: 1, flexDirection: "row", alignItems: "center",
        justifyContent: "center", paddingVertical: 10,
        borderRadius: 10, gap: 6,
    },
    modeBtnActive: { backgroundColor: "#7c3aed" },
    modeBtnText: { fontSize: 13, fontWeight: "700", color: colors.muted },
    modeBtnTextActive: { color: "#fff" },

    // Kartlar
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16, padding: 20,
        borderWidth: 1, borderColor: colors.surfaceBorder,
    },
    cardTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 16 },

    // Ay seçici
    monthPicker: {
        flexDirection: "row", alignItems: "center",
        justifyContent: "center", gap: 12,
    },
    arrowBtn: { padding: 4 },
    monthDisplay: { alignItems: "center", minWidth: 140 },
    monthText: { fontSize: 26, fontWeight: "900", color: "#5b21b6" },
    yearText: { fontSize: 14, color: "#7c3aed", fontWeight: "600" },

    // Firma listesi
    firmRow: {
        flexDirection: "row", alignItems: "center",
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: 12, marginBottom: 8,
        backgroundColor: colors.background,
        borderWidth: 1.5, borderColor: colors.surfaceBorder,
    },
    firmRowSelected: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
    firmName: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 2 },
    firmDebt: { fontSize: 12, fontWeight: "600" },
    firmCheck: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 2, borderColor: colors.surfaceBorder,
        alignItems: "center", justifyContent: "center",
    },
    firmCheckActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },

    // Bilgi kutusu
    infoBox: {
        flexDirection: "row", gap: 10,
        backgroundColor: "#ede9fe",
        borderRadius: 12, padding: 14,
    },
    infoText: { fontSize: 13, color: "#4c1d95", lineHeight: 18, marginBottom: 4 },
    infoSubText: { fontSize: 11, color: "#6d28d9", fontStyle: "italic" },

    // Önizleme butonu
    previewBtn: {
        backgroundColor: "#7c3aed",
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        paddingVertical: 16, borderRadius: 14, gap: 8,
    },
    previewBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40,
    },
    modalHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 20,
    },
    modalHeaderRow: {
        flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4,
    },
    modalTitle: { fontSize: 20, fontWeight: "900", color: "#1e293b" },
    modalPeriod: { fontSize: 14, color: "#64748b", marginBottom: 20, marginLeft: 38 },
    summaryTable: {
        borderRadius: 12, overflow: "hidden",
        borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16,
    },
    summaryRow: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", padding: 14,
        borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
    },
    summaryRowTotal: {
        backgroundColor: "#fef2f2", borderBottomWidth: 0,
    },
    summaryLabel: { fontSize: 14, color: "#475569" },
    summaryVal: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
    noDebtBanner: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#f0fdf4", borderRadius: 10,
        padding: 12, marginBottom: 12,
    },
    warningText: {
        fontSize: 12, color: "#92400e",
        backgroundColor: "#fef3c7", borderRadius: 8,
        padding: 10, lineHeight: 18, marginBottom: 20,
    },
    modalBtns: { flexDirection: "row", gap: 12 },
    cancelBtn: {
        flex: 1, paddingVertical: 15, borderRadius: 12,
        alignItems: "center", backgroundColor: "#f1f5f9",
    },
    cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#475569" },
    confirmBtn: {
        flex: 2, paddingVertical: 15, borderRadius: 12,
        flexDirection: "row", alignItems: "center",
        justifyContent: "center", backgroundColor: "#dc2626", gap: 8,
    },
    confirmBtnText: { fontSize: 15, fontWeight: "bold", color: "#fff" },
});
