import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_COLORS: any = {
  "PENDING": "#f39c12",
  "PREPARING": "#3498db",
  "READY": "#9b59b6",
  "COMPLETED": "#2ecc71",
  "CANCELLED": "#e74c3c",
};

const STATUS_LABELS: any = {
  "PENDING": "Sipariş Alındı",
  "PREPARING": "Mutfakta",
  "READY": "Yolda",
  "COMPLETED": "Teslim Edildi",
  "CANCELLED": "İptal Edildi",
};

export default function AdminDashboard() {
  const { orders, loading, updateOrderStatus } = useAdisyon();
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);
  const router = useRouter();

  const activePacketOrders = useMemo(() => {
    return (orders || [])
      .filter(o => ["PAKET", "Sipariş Ver"].includes(o.order_type) && !["COMPLETED", "CANCELLED", "PAID"].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders]);

  if (loading && activePacketOrders.length === 0) {
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
          <Text style={styles.title}>Canlı Siparişler</Text>
          <Text style={styles.subtitle}>SADECE AKTİF PAKET SİPARİŞLERİ</Text>
        </View>
        <ThemeSwitcher />
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.summaryBtn} 
          onPress={() => router.push("/(admin)/summary")}
        >
          <MaterialIcons name="assessment" size={20} color="#fff" />
          <Text style={styles.summaryBtnText}>Özet & Borçlar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activePacketOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="delivery-dining" size={64} color={colors.surfaceBorder} />
            <Text style={{ color: colors.muted, marginTop: 12, fontWeight: 'bold' }}>Aktif paket siparişi bulunmuyor</Text>
          </View>
        ) : (
          activePacketOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderUser}>{order.userName || "Müşteri"}</Text>
                  <Text style={styles.orderTime}>{new Date(order.created_at).toLocaleTimeString('tr-TR')}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] || colors.primary }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[order.status] || order.status}</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {order.adisyon_items?.map((item: any) => (
                  <View key={item.id} style={{ marginBottom: 8 }}>
                    <Text style={styles.itemRow}>
                      • {item.quantity}x {item.menu_items?.name}
                    </Text>
                    {item.selections && Array.isArray(item.selections) && item.selections.length > 0 && (
                      <View style={styles.tabldotSelections}>
                        {item.selections.map((sel: any, idx: number) => (
                          <Text key={idx} style={styles.selectionText}>
                            └ {sel.item_name} ({sel.category})
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {order.note && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>Not: {order.note}</Text>
                  </View>
                )}
              </View>

              <View style={styles.actionRow}>
                {order.status === "PENDING" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: STATUS_COLORS.PREPARING }]}
                    onPress={() => updateOrderStatus(order.id, "PREPARING")}
                  >
                    <Text style={styles.actionBtnText}>Mutfağa Al</Text>
                  </TouchableOpacity>
                )}
                {order.status === "PREPARING" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: STATUS_COLORS.READY }]}
                    onPress={() => updateOrderStatus(order.id, "READY")}
                  >
                    <Text style={styles.actionBtnText}>Yola Çıkar</Text>
                  </TouchableOpacity>
                )}
                {order.status === "READY" && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: STATUS_COLORS.COMPLETED }]}
                    onPress={() => updateOrderStatus(order.id, "COMPLETED")}
                  >
                    <Text style={styles.actionBtnText}>Teslim Edildi</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger }]}
                  onPress={() => updateOrderStatus(order.id, "CANCELLED")}
                >
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 10, color: colors.muted, fontWeight: 'bold' },
  quickActions: { paddingHorizontal: 24, marginBottom: 16 },
  summaryBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  summaryBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  orderCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderUser: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  orderTime: { fontSize: 12, color: colors.muted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  itemsList: { marginBottom: 16 },
  itemRow: { fontSize: 14, color: colors.text, fontWeight: 'bold' },
  tabldotSelections: { marginLeft: 16, marginTop: 2, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.surfaceBorder },
  selectionText: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  noteBox: { backgroundColor: colors.cardHighlight, padding: 10, borderRadius: 8, marginTop: 8 },
  noteText: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
});
