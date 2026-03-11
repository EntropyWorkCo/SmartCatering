import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { notificationService } from "@/lib/services/notificationService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from 'expo-print';
import { useFocusEffect } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminDashboard() {
  const { orders, loading, updateOrderStatus } = useAdisyon();
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const [ratings, setRatings] = useState<any[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchRatings = async () => {
        const { data, error } = await supabase
          .from("feedbacks")
          .select("*");
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
          name: string;
          isCorporate: boolean;
          displayName: string;
          total: number;
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

        // Kurumsalsa şirket adı, bireysel ise kullanıcı id'si key olsun
        const key = isActuallyCorporate
          ? order.companyName
          : order.user_id;

        if (!map[key]) {
          map[key] = {
            userId: order.user_id,
            name: order.userName || "Bilinmeyen Müşteri",
            isCorporate: isActuallyCorporate,
            displayName: isActuallyCorporate
              ? order.companyName
              : order.userName || "Bireysel Müşteri",
            total: 0,
            count: 0,
            orders: [],
          };
        }

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
    () => groupedAccounts.reduce((acc, curr) => acc + curr.total, 0),
    [groupedAccounts]
  );

  const handleCollectAll = (userId: string) => {
    Alert.alert(
      "Borç Ödendi",
      "Bu müşterinin tüm bekleyen borçları tahsil edildi olarak işaretlenecek. Onaylıyor musunuz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Evet, Tahsil Et",
          onPress: async () => {
            const userOrders = groupedAccounts.find(a => a.userId === userId)?.orders || [];
            const activeOrders = userOrders.filter(o => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status));

            for (const po of activeOrders) {
              await updateOrderStatus(po.id, 'PAID');
            }

            // Bildirim Gönder
            try {
              const tokens = await notificationService.getPushTokens(userId);
              if (tokens.length > 0) {
                await notificationService.sendPushNotification(
                  tokens,
                  "✅ Borcunuz Tahsil Edildi",
                  "Yemek borcunuz sistem üzerinden sıfırlanmıştır. Teşekkür ederiz!",
                  { type: "debt_cleared" }
                );
              }
            } catch (err) {
              console.log("Bildirim gönderilemedi:", err);
            }
          },
          style: "destructive"
        },
      ]
    );
  };

  const handleExportPDF = async (account: any) => {
    try {
      const activeOrders = account.orders.filter((o: any) => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status));
      const paidOrders = account.orders.filter((o: any) => ["PAID", "Ödendi"].includes(o.status));

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
              .paid-status { color: #4CAF50; font-weight: bold; font-size: 11px; }
              .pending-status { color: #f39c12; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="header">
              <p class="title">SMART CATERING</p>
              <p style="margin:5px 0; font-size:14px; color:#666;">Tahsilat & Ekstre Dökümü</p>
            </div>

            <div class="meta">
              <div class="meta-item"><strong>Müşteri:</strong> ${account.displayName}</div>
              <div class="meta-item"><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            </div>

            ${activeOrders.length > 0 ? `
              <div class="section-title">BEKLEYEN BORÇLAR</div>
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Detay</th>
                    <th style="text-align:right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeOrders.map((o: any) => `
                    <tr>
                      <td>${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                      <td>
                        ${o.adisyon_items?.map((i: any) => `${i.quantity}x ${i.menu_items?.name || 'Ürün'}`).join(', ')}
                        ${o.note ? `<br/><small style="color:#888 italic">Not: ${o.note}</small>` : ''}
                      </td>
                      <td style="text-align:right">₺${o.total_amount?.toLocaleString('tr-TR')}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="2" style="border:none; padding-top:20px">TOPLAM BORÇ</td>
                    <td style="text-align:right; color:#ed1c24; border:none; padding-top:20px">₺${account.total.toLocaleString('tr-TR')}</td>
                  </tr>
                </tbody>
              </table>
            ` : '<p style="font-size:14px; color:#666;">Bekleyen borç bulunmamaktadır.</p>'}

            ${paidOrders.length > 0 ? `
              <div class="section-title">GEÇMİŞ ÖDEMELER (TAHSİLATLAR)</div>
              <table>
                <thead>
                  <tr>
                    <th>Sipariş Tarihi</th>
                    <th>Ödeme Tarihi</th>
                    <th style="text-align:right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  ${paidOrders.map((o: any) => `
                    <tr>
                      <td>${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                      <td class="paid-status">${o.paid_at ? new Date(o.paid_at).toLocaleDateString('tr-TR') : 'Ödendi'}</td>
                      <td style="text-align:right">₺${o.total_amount?.toLocaleString('tr-TR')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="footer">
              <p>Bu belge sistem tarafından otomatik oluşturulmuştur.</p>
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

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Borçlar</Text>
        </View>
        <ThemeSwitcher />
      </View>

      <View style={styles.tabContainer}>

        <TouchableOpacity
          style={[
            styles.tab,
            mainTab === "KURUMSAL" && styles.activeTab,
          ]}
          onPress={() => setMainTab("KURUMSAL")}
        >
          <Text
            style={[
              styles.tabText,
              mainTab === "KURUMSAL" && styles.activeTabText,
            ]}
          >
            KURUMSAL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            mainTab === "BIREYSEL" && styles.activeTab,
          ]}
          onPress={() => setMainTab("BIREYSEL")}
        >
          <Text
            style={[
              styles.tabText,
              mainTab === "BIREYSEL" && styles.activeTabText,
            ]}
          >
            BİREYSEL
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {true && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>
              TOPLAM BEKLEYEN BORÇ
            </Text>
            <Text style={styles.totalAmount}>
              ₺{totalDebt.toLocaleString("tr-TR")}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.miniStatCard}>
            <View>
              <Text style={styles.miniStatLabel}>SİSTEM PUANI</Text>
              <Text style={styles.miniStatValue}>{averageRating} / 5</Text>
            </View>
          </View>

          <View style={styles.miniStatCard}>
            <View>
              <Text style={styles.miniStatLabel}>GELEN YORUM</Text>
              <Text style={styles.miniStatValue}>{ratings.length} Adet</Text>
            </View>
          </View>
        </View>



        {groupedAccounts.map((account) => (
          <View key={account.userId} style={styles.accountCard}>
            <View style={styles.accountTop}>
              <View style={styles.accountTextCont}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {account.displayName}
                </Text>
                <Text style={styles.accountBalance}>
                  Açık Borç:{" "}
                  <Text
                    style={{
                      color: account.total > 0 ? colors.text : colors.muted,
                      fontWeight: account.total > 0 ? "bold" : "normal"
                    }}
                  >
                    ₺{account.total.toLocaleString("tr-TR")}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={styles.accountActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => setPreviewAccount(account)}
              >
                <Text style={styles.outlineBtnText}>Ekstre İncele</Text>
              </TouchableOpacity>

              {account.total > 0 && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => handleCollectAll(account.userId)}
                >
                  <Text style={styles.primaryBtnText}>Tahsilatı Onayla</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {groupedAccounts.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <MaterialIcons name="inbox" size={48} color={colors.surfaceBorder} />
            <Text style={{ marginTop: 10, color: colors.muted, fontWeight: 'bold' }}>Kayıt bulunamadı</Text>
          </View>
        )}
      </ScrollView>

      {/* Önizleme Modalı */}
      {previewAccount && (
        <Modal visible={!!previewAccount} transparent={false} animationType="slide" onRequestClose={() => setPreviewAccount(null)}>
          <View style={[styles.invoiceModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={styles.invoiceHeader}>
              <Text style={[styles.invoiceTitle, { color: colors.text }]}>Tahsilat Ekstresi</Text>
              <TouchableOpacity onPress={() => setPreviewAccount(null)} style={styles.invoiceCloseBtn}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Kapat</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

              <View style={styles.invoiceMetaGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={[styles.invoiceMetaLabel, { color: colors.muted }]}>MÜŞTERİ / FİRMA ÜNVANI</Text>
                    <Text style={[styles.invoiceMetaValue, { color: colors.text }]}>{previewAccount.displayName}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.outlineBtn, { paddingHorizontal: 16, flex: 0, height: 40, justifyContent: 'center' }]}
                    onPress={() => handleExportPDF(previewAccount)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="picture-as-pdf" size={18} color={colors.primary} />
                      <Text style={[styles.outlineBtnText, { color: colors.primary }]}>PDF Yap</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.invoiceDivider} />

              <Text style={[styles.modalSectionTitle, { color: Object.values(Colors).find(c => c === colors)?.text || '#111' }]}>
                ONAY BEKLEYEN İŞLEMLER DOSYASI
              </Text>

              {previewAccount.orders
                .filter((o: any) => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status))
                .map((order: any, index: number) => (
                  <View key={order.id} style={styles.simpleOrderRow}>
                    <View style={styles.simpleOrderRowHeader}>
                      <Text style={[styles.simpleOrderDate, { color: colors.text }]}>
                        {new Date(order.created_at).toLocaleDateString("tr-TR")} - {order.userName}
                      </Text>
                      <Text style={[styles.simpleOrderTotal, { color: colors.text }]}>₺{order.total_amount?.toLocaleString("tr-TR")}</Text>
                    </View>

                    {order.adisyon_items && order.adisyon_items.map((item: any) => (
                      <View key={item.id} style={styles.simpleItemRow}>
                        <Text style={[styles.simpleItemCount, { color: colors.text }]}>{item.quantity}x</Text>
                        <Text style={[styles.simpleItemName, { color: colors.muted }]}>{item.menu_items?.name || 'Ürün'}</Text>
                        <Text style={[styles.simpleItemPrice, { color: colors.muted }]}> {item.line_total}₺</Text>
                      </View>
                    ))}
                    {order.note ? (
                      <Text style={[styles.simpleNote, { color: colors.muted }]}>Not: {order.note}</Text>
                    ) : null}
                  </View>
                ))}

              {previewAccount.orders.some((o: any) => ["PAID", "Ödendi"].includes(o.status)) && (
                <>
                  <View style={styles.invoiceDivider} />
                  <Text style={[styles.modalSectionTitle, { color: colors.primary }]}>
                    GEÇMİŞ TAHSİLATLAR (KAPALI BORÇLAR)
                  </Text>
                  {previewAccount.orders
                    .filter((o: any) => ["PAID", "Ödendi"].includes(o.status))
                    .sort((a: any, b: any) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
                    .map((order: any) => (
                      <View key={order.id} style={[styles.simpleOrderRow, { opacity: 0.7 }]}>
                        <View style={styles.simpleOrderRowHeader}>
                          <View>
                            <Text style={[styles.simpleOrderDate, { color: colors.text }]}>
                              {new Date(order.created_at).toLocaleDateString("tr-TR")}
                            </Text>
                            {order.paid_at && (
                              <Text style={{ fontSize: 10, color: '#4CAF50', fontWeight: 'bold' }}>
                                Ödeme: {new Date(order.paid_at).toLocaleDateString("tr-TR")}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.simpleOrderTotal, { color: colors.text }]}>₺{order.total_amount?.toLocaleString("tr-TR")}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.muted }}>{order.userName} - Tahsil Edildi</Text>
                      </View>
                    ))}
                </>
              )}

              <View style={styles.invoiceDivider} />

              <View style={styles.invoiceTotalBox}>
                <Text style={[styles.invoiceTotalLabel, { color: colors.text }]}>TOPLAM BORÇ (KDV DAHİL)</Text>
                <Text style={[styles.invoiceTotalValue, { color: colors.text }]}>₺{previewAccount.total.toLocaleString("tr-TR")}</Text>
              </View>

              {previewAccount.total > 0 && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginBottom: 32, marginTop: 32, height: 50, justifyContent: 'center' }]}
                  onPress={() => {
                    handleCollectAll(previewAccount.userId);
                    setPreviewAccount(null);
                  }}
                >
                  <Text style={[styles.primaryBtnText, { fontSize: 16 }]}>Ödemeyi Onayla ve Kapat</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.muted,
  },
  activeTabText: {
    color: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  miniStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalCard: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    marginBottom: 16,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  totalAmount: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "bold",
  },
  accountCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  accountTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  accountTextCont: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 12,
    color: colors.muted,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderTypeTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.muted,
    backgroundColor: colors.surfaceBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderNoteAdmin: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  invoiceModalContainer: {
    flex: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  invoiceCloseBtn: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  invoiceMetaGroup: {
    marginBottom: 24,
  },
  invoiceMetaLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  invoiceMetaValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  simpleOrderRow: {
    marginBottom: 16,
  },
  simpleOrderRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  simpleOrderDate: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  simpleOrderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  simpleItemRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  simpleItemCount: {
    width: 20,
    fontSize: 12,
  },
  simpleItemName: {
    flex: 1,
    fontSize: 12,
  },
  simpleItemPrice: {
    fontSize: 12,
  },
  simpleNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  invoiceTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  invoiceTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  invoiceTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  }
});
