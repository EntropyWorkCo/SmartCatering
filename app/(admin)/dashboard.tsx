import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL");

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
        const isActuallyCorporate =
          order.isCorporate === true ||
          (order.companyName &&
            order.companyName !== "Bireysel Üyelik" &&
            order.companyName.trim() !== "");

        const match =
          (mainTab === "KURUMSAL" && isActuallyCorporate) ||
          (mainTab === "BIREYSEL" && !isActuallyCorporate);

        if (!match) return;

        const key = isActuallyCorporate
          ? order.companyName || order.user_id
          : order.user_id;

        if (!map[key]) {
          map[key] = {
            userId: order.user_id,
            name: order.userName || "Bilinmeyen Müşteri",
            isCorporate: isActuallyCorporate,
            displayName: isActuallyCorporate
              ? order.companyName || order.userName || "Kurumsal Müşteri"
              : order.userName || "Bireysel Müşteri",
            total: 0,
            count: 0,
            orders: [],
          };
        }

        if (order.status === "PENDING") {
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
            const pendingOrders = userOrders.filter(o => o.status === 'PENDING');

            for (const po of pendingOrders) {
              await updateOrderStatus(po.id, 'COMPLETED');
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
          <Text style={styles.totalLabel}>TOPLAM BEKLEYEN ALACAK</Text>
          <Text style={styles.totalAmount}>
            ₺{totalDebt.toLocaleString("tr-TR")}
          </Text>
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
                onPress={() => {
                  Alert.alert("Detaylar", `${account.displayName} adlı müşterinin ${account.count} siparişi var.`);
                }}
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
  }
});
