import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
          },
          style: "destructive"
        },
      ]
    );
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
          <Text style={styles.title}>Özet Dashboard</Text>
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
          <MaterialIcons
            name="apartment"
            size={24}
            color={mainTab === "KURUMSAL" ? (theme === 'dark' ? '#0f172a' : '#fff') : colors.muted}
          />
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
          <MaterialIcons
            name="person"
            size={24}
            color={mainTab === "BIREYSEL" ? (theme === 'dark' ? '#0f172a' : '#fff') : colors.muted}
          />
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
        <View style={styles.totalCard}>
          <MaterialIcons
            name="account-balance-wallet"
            size={80}
            color="rgba(255,255,255,0.05)"
            style={styles.totalIcon}
          />
          <Text style={styles.totalAmount}>
            ₺{totalDebt.toLocaleString("tr-TR")}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.miniStatCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={[styles.miniIconBox, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
              <MaterialIcons name="star" size={20} color="#fbbf24" />
            </View>
            <View>
              <Text style={styles.miniStatLabel}>GENEL PUAN</Text>
              <Text style={styles.miniStatValue}>{averageRating} / 5.0</Text>
            </View>
          </View>

          <View style={[styles.miniStatCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={[styles.miniIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <MaterialIcons name="rate-review" size={20} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.miniStatLabel}>YORUM SAYISI</Text>
              <Text style={styles.miniStatValue}>{ratings.length} Adet</Text>
            </View>
          </View>
        </View>

        {groupedAccounts.map((account) => (
          <View key={account.userId} style={styles.accountCard}>
            <View style={styles.accountTop}>
              <View style={styles.accountInfo}>
                <View
                  style={[
                    styles.avatar,
                    account.total > 0
                      ? { backgroundColor: "rgba(245, 158, 11, 0.1)" }
                      : { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                  ]}
                >
                  <MaterialIcons
                    name={account.isCorporate ? "factory" : "person"}
                    size={24}
                    color={account.total > 0 ? "#f59e0b" : "#10b981"}
                  />
                </View>
                <View style={styles.accountTextCont}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {account.displayName}
                  </Text>
                  <Text style={styles.accountBalance}>
                    Bakiye:{" "}
                    <Text
                      style={{
                        color: account.total > 0 ? "#f59e0b" : colors.muted,
                      }}
                    >
                      ₺{account.total.toLocaleString("tr-TR")}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.accountActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => setPreviewAccount(account)}
              >
                <Text style={styles.outlineBtnText}>ÖNİZLEME</Text>
              </TouchableOpacity>

              {account.total > 0 && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => handleCollectAll(account.userId)}
                >
                  <Text style={styles.primaryBtnText}>TAHSİL ET</Text>
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
        <Modal visible={!!previewAccount} transparent animationType="slide" onRequestClose={() => setPreviewAccount(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{previewAccount.displayName}</Text>
                <TouchableOpacity onPress={() => setPreviewAccount(null)} style={styles.modalCloseBtn}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSectionTitle}>BEKLEYEN SİPARİŞLER</Text>

                {previewAccount.orders
                  .filter((o: any) => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status))
                  .map((order: any) => (
                    <View key={order.id} style={[styles.modalOrderCard, { borderColor: colors.surfaceBorder, backgroundColor: colors.surface }]}>
                      <View style={styles.modalOrderHeader}>
                        <View>
                          <Text style={[styles.modalOrderDate, { color: colors.muted }]}>
                            {new Date(order.created_at).toLocaleDateString("tr-TR", { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={{ fontSize: 10, color: colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                            SİPARİŞİ VEREN: {order.userName}
                          </Text>
                        </View>
                        <Text style={[styles.modalOrderTotal, { color: colors.text }]}>₺{order.total_amount?.toLocaleString("tr-TR")}</Text>
                      </View>

                      {order.adisyon_items && order.adisyon_items.map((item: any) => (
                        <View key={item.id} style={styles.modalItemRow}>
                          <Text style={[styles.modalItemCount, { color: colors.primary }]}>{item.quantity}x </Text>
                          <Text style={[styles.modalItemName, { color: colors.text }]}>{item.menu_items?.name || 'Ürün'}</Text>
                          <Text style={[styles.modalItemPrice, { color: colors.muted }]}>₺{item.line_total}</Text>
                        </View>
                      ))}
                      {order.note ? (
                        <Text style={[styles.modalOrderNote, { color: colors.info }]}>Not: {order.note}</Text>
                      ) : null}
                    </View>
                  ))}

                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryLabel}>TOPLAM BORÇ YÜKÜ</Text>
                  <Text style={[styles.modalSummaryValue, { color: colors.primary }]}>₺{previewAccount.total.toLocaleString("tr-TR")}</Text>
                </View>

                {previewAccount.total > 0 && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginBottom: 32, marginTop: 16, height: 56, justifyContent: 'center' }]}
                    onPress={() => {
                      handleCollectAll(previewAccount.userId);
                      setPreviewAccount(null);
                    }}
                  >
                    <Text style={[styles.primaryBtnText, { fontSize: 14 }]}>TÜMÜNÜ TAHSİL ET</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
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
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activeTabText: {
    color: colors.background === '#0f172a' ? '#0f172a' : '#fff', // ensures contrast on primary
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
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  miniIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 2,
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
  },
  totalCard: {
    backgroundColor: colors.surfaceBorder,
    borderRadius: 32,
    padding: 28,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  totalIcon: {
    position: "absolute",
    right: 10,
    top: 10,
  },
  totalLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  totalAmount: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  accountTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
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
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: colors.muted,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder
  },
  outlineBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 1
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  modalBody: {
    flex: 1,
  },
  modalSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  modalOrderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modalOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  modalOrderDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOrderTotal: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalItemCount: {
    fontSize: 13,
    fontWeight: '900',
    width: 24,
  },
  modalItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOrderNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    fontWeight: '500',
  },
  modalSummaryBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(150,150,150,0.05)',
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.1)',
  },
  modalSummaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 2,
    marginBottom: 8,
  },
  modalSummaryValue: {
    fontSize: 32,
    fontWeight: '900',
  }
});
