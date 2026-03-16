import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { billingService } from "@/lib/services/billingService";
import { notificationService } from "@/lib/services/notificationService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SummaryScreen() {
  const { orders, loading, updateOrderStatus } = useAdisyon();
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);
  const router = useRouter();

  const [ratings, setRatings] = useState<any[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(true);

  // Borç Düzenleme Modalı State
  const [debtModalVisible, setDebtModalVisible] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [updatingDebt, setUpdatingDebt] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchRatings = async () => {
        const { data, error } = await supabase
          .from("feedbacks")
          .select("*, users!feedbacks_user_id_fkey(full_name, companies!companies_user_id_fkey(company_name))");
        if (data) setRatings(data);
        setLoadingRatings(false);
      };
      fetchRatings();
    }, [])
  );

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return "0.0";
    const sum = ratings.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    return (sum / ratings.length).toFixed(1);
  }, [ratings]);

  const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL");
  const [previewAccount, setPreviewAccount] = useState<any | null>(null);

  const groupedAccounts = useMemo(() => {
    try {
      const map: Record<
        string,
        {
          userId: string;
          companyId?: string;
          name: string;
          isCorporate: boolean;
          displayName: string;
          total: number;
          manualDebt: number;
          count: number;
          orders: any[];
        }
      > = {};

      const safeOrders = orders || [];

      safeOrders.forEach((order) => {
        const isActuallyCorporate = !!order.companyName;

        const match =
          (mainTab === "KURUMSAL" && isActuallyCorporate) ||
          (mainTab === "BIREYSEL" && !isActuallyCorporate);

        if (!match) return;

        const key = isActuallyCorporate
          ? order.companyName
          : order.user_id;

        if (!map[key]) {
          map[key] = {
            userId: order.user_id,
            companyId: order.company_id,
            name: order.userName || "Bilinmeyen Müşteri",
            isCorporate: isActuallyCorporate,
            displayName: isActuallyCorporate
              ? order.companyName
              : order.userName || "Bireysel Müşteri",
            total: 0,
            manualDebt: order.companies?.balance || 0,
            count: 0,
            orders: [],
          };
        }

        // Bireysel ise sipariş toplamlarını ekle, kurumsal ise adminin girdiği balance'ı göstereceğiz
        if (!["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(order.status)) {
           map[key].total += order.total_amount || 0;
        }
        
        map[key].count += 1;
        map[key].orders.push(order);
      });

      return Object.values(map).sort((a, b) => b.total - a.total);
    } catch (e) {
      console.error("Gruplama hatası:", e);
      return [];
    }
  }, [orders, mainTab]);

  const totalDebt = useMemo(
    () => groupedAccounts.reduce((acc, curr) => acc + (curr.isCorporate ? curr.manualDebt : curr.total), 0),
    [groupedAccounts]
  );

  const handleUpdateDebt = async () => {
    if (!selectedCompanyId || !newDebtAmount) return;
    setUpdatingDebt(true);
    try {
      await billingService.updateCompanyBalance(selectedCompanyId, Number(newDebtAmount));
      Alert.alert("Başarılı", "Borç tutarı güncellendi.");
      setDebtModalVisible(false);
      setNewDebtAmount("");
      // Refresh logic would go here, usually useAdisyon would re-fetch if linked
    } catch (err: any) {
      Alert.alert("Hata", "Borç güncellenirken hata oluştu: " + err.message);
    } finally {
      setUpdatingDebt(false);
    }
  };

  const handleExportPDF = async (account: any) => {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; border-bottom: 2px solid #ed1c24; padding-bottom: 10px; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; color: #ed1c24; margin: 0; }
              .meta { margin-bottom: 30px; }
              .meta-item { margin-bottom: 5px; font-size: 14px; }
              .section-title { font-size: 16px; font-weight: bold; background: #f8f8f8; padding: 8px; margin: 20px 0 10px 0; border-left: 4px solid #ed1c24; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
              th { text-align: left; font-size: 12px; color: #666; padding: 8px; border-bottom: 1px solid #eee; }
              td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
              .total-row { background: #fff; font-weight: bold; font-size: 18px; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="header">
              <p class="title">SMART CATERING</p>
              <p style="margin:5px 0; font-size:14px; color:#666;">Yemek Özet & Tahsilat Dökümü</p>
            </div>

            <div class="meta">
              <div class="meta-item"><strong>Müşteri:</strong> ${account.displayName}</div>
              <div class="meta-item"><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            </div>

            <div class="section-title">HİZMET DETAYLARI (ADET)</div>
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Ürün Detayı</th>
                  <th style="text-align:right">Adet</th>
                </tr>
              </thead>
              <tbody>
                ${account.orders.map((o: any) => `
                  <tr>
                    <td>${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                    <td>
                      ${o.adisyon_items?.map((i: any) => `${i.menu_items?.name || 'Ürün'}`).join(', ')}
                    </td>
                    <td style="text-align:right">${o.adisyon_items?.reduce((acc: number, curr: any) => acc + curr.quantity, 0)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="2" style="border:none; padding-top:20px">TOPLAM BORÇ TUTARI</td>
                  <td style="text-align:right; color:#ed1c24; border:none; padding-top:20px">₺${(account.isCorporate ? account.manualDebt : account.total).toLocaleString('tr-TR')}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>Bu belge bilgilendirme amaçlıdır. Ödeme detayları için işletme ile iletişime geçiniz.</p>
              <p><strong>Smart Catering İşletme Yönetimi</strong></p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Özet & Borçlar</Text>
        </View>
        <ThemeSwitcher />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, mainTab === "KURUMSAL" && styles.activeTab]}
          onPress={() => setMainTab("KURUMSAL")}
        >
          <Text style={[styles.tabText, mainTab === "KURUMSAL" && styles.activeTabText]}>KURUMSAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === "BIREYSEL" && styles.activeTab]}
          onPress={() => setMainTab("BIREYSEL")}
        >
          <Text style={[styles.tabText, mainTab === "BIREYSEL" && styles.activeTabText]}>BİREYSEL</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOPLAM BEKLEYEN BORÇ</Text>
          <Text style={styles.totalAmount}>₺{totalDebt.toLocaleString("tr-TR")}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.miniStatCard}>
            <Text style={styles.miniStatLabel}>SİSTEM PUANI</Text>
            <Text style={styles.miniStatValue}>{averageRating} / 5</Text>
          </View>
          <View style={styles.miniStatCard}>
            <Text style={styles.miniStatLabel}>GELEN YORUM</Text>
            <Text style={styles.miniStatValue}>{ratings.length} Adet</Text>
          </View>
        </View>

        {groupedAccounts.map((account) => (
          <View key={account.userId} style={styles.accountCard}>
            <View style={styles.accountTop}>
              <View style={styles.accountTextCont}>
                <Text style={styles.accountName}>{account.displayName}</Text>
                <Text style={styles.accountBalance}>
                  Güncel Borç: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>₺{(account.isCorporate ? account.manualDebt : account.total).toLocaleString("tr-TR")}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.accountActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setPreviewAccount(account)}>
                <Text style={styles.outlineBtnText}>Döküm İncele</Text>
              </TouchableOpacity>

              {account.isCorporate && (
                <TouchableOpacity 
                   style={[styles.primaryBtn, { backgroundColor: colors.info }]} 
                   onPress={() => {
                     setSelectedCompanyId(account.companyId || "");
                     setNewDebtAmount((account.manualDebt || 0).toString());
                     setDebtModalVisible(true);
                   }}
                >
                  <Text style={styles.primaryBtnText}>Borç Gir/Düzenle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Borç Giriş Modalı */}
      <Modal visible={debtModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manuel Borç Girişi</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>
              Şirketin 15 günlük toplam borç tutarını buraya giriniz.
            </Text>
            <TextInput
               style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder }]}
               keyboardType="numeric"
               value={newDebtAmount}
               onChangeText={setNewDebtAmount}
               placeholder="Tutar giriniz (₺)"
               placeholderTextColor={colors.muted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDebtModalVisible(false)}>
                <Text style={{ color: colors.muted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleUpdateDebt} disabled={updatingDebt}>
                {updatingDebt ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Güncelle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Önizleme Modalı */}
      {previewAccount && (
        <Modal visible={!!previewAccount} transparent={false} animationType="slide">
          <View style={[styles.invoiceModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
             <View style={styles.invoiceHeader}>
               <Text style={[styles.invoiceTitle, { color: colors.text }]}>Sipariş Özeti</Text>
               <TouchableOpacity onPress={() => setPreviewAccount(null)} style={styles.invoiceCloseBtn}>
                 <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Kapat</Text>
               </TouchableOpacity>
             </View>
             <ScrollView style={styles.modalBody}>
               <View style={styles.invoiceMetaGroup}>
                  <Text style={[styles.invoiceMetaLabel, { color: colors.muted }]}>MÜŞTERİ / FİRMA ÜNVANI</Text>
                  <Text style={[styles.invoiceMetaValue, { color: colors.text }]}>{previewAccount.displayName}</Text>
               </View>
               <TouchableOpacity style={styles.pdfBtn} onPress={() => handleExportPDF(previewAccount)}>
                 <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
                 <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>PDF Olarak İndir</Text>
               </TouchableOpacity>

               <View style={styles.invoiceDivider} />
               <Text style={[styles.modalSectionTitle, { color: colors.text }]}>HİZMET DÖKÜMÜ (LİSTE)</Text>
               {previewAccount.orders.map((order: any) => (
                 <View key={order.id} style={styles.simpleOrderRow}>
                   <Text style={[styles.simpleOrderDate, { color: colors.text }]}>{new Date(order.created_at).toLocaleDateString("tr-TR")}</Text>
                   {order.adisyon_items?.map((item: any) => (
                     <Text key={item.id} style={{ color: colors.muted, fontSize: 12 }}>• {item.quantity}x {item.menu_items?.name}</Text>
                   ))}
                 </View>
               ))}
               <View style={styles.invoiceDivider} />
               <View style={styles.invoiceTotalBox}>
                 <Text style={[styles.invoiceTotalLabel, { color: colors.text }]}>GÜNCEL BORÇ</Text>
                 <Text style={[styles.invoiceTotalValue, { color: colors.primary }]}>₺{(previewAccount.isCorporate ? previewAccount.manualDebt : previewAccount.total).toLocaleString("tr-TR")}</Text>
               </View>
             </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: 16, borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  tabContainer: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 20, gap: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "bold", color: colors.muted },
  activeTabText: { color: colors.primary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  totalCard: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, marginBottom: 16 },
  totalLabel: { color: colors.muted, fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: "900" },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  miniStatCard: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  miniStatLabel: { fontSize: 10, fontWeight: 'bold', color: colors.muted, marginBottom: 4 },
  miniStatValue: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  accountCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  accountTop: { marginBottom: 12 },
  accountTextCont: {  },
  accountName: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  accountBalance: { fontSize: 12, color: colors.muted },
  accountActions: { flexDirection: 'row', gap: 12 },
  outlineBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
  outlineBtnText: { fontSize: 12, fontWeight: 'bold', color: colors.text },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  debtInput: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modalConfirm: { flex: 2, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  invoiceModalContainer: { flex: 1 },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder },
  invoiceTitle: { fontSize: 18, fontWeight: 'bold' },
  invoiceCloseBtn: { padding: 8 },
  modalBody: { flex: 1, padding: 24 },
  invoiceMetaGroup: { marginBottom: 24 },
  invoiceMetaLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  invoiceMetaValue: { fontSize: 20, fontWeight: 'bold' },
  pdfBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginBottom: 24 },
  invoiceDivider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 16 },
  modalSectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
  simpleOrderRow: { marginBottom: 12 },
  simpleOrderDate: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  invoiceTotalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  invoiceTotalLabel: { fontSize: 14, fontWeight: 'bold' },
  invoiceTotalValue: { fontSize: 24, fontWeight: '900' }
});
