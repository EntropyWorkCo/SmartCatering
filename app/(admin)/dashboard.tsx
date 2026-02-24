import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Dashboard() {
  const { orders, createOrder, loading } = useAdisyon();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74CF62" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Yönetici Paneli</Text>
        <Text style={styles.subtitle}>Gelen Siparişler</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderId}>Sipariş: {item.id.slice(0, 8)}</Text>
              <Text style={styles.orderStatus}>{item.status}</Text>
            </View>
            <Text style={styles.amount}>{item.total_amount} TL</Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          // SERVİSİN BEKLEDİĞİ 3 ARGÜMANI GÖNDERİYORUZ:
          // 1. userId (String), 2. totalAmount (Number), 3. items (Array)
          const dummyUserId = "admin-test-id";
          const dummyAmount = 150;
          const dummyItems = [{ menu_item_id: 1, quantity: 1, price: 150 }];

          createOrder(dummyUserId, dummyAmount, dummyItems);
        }}
      >
        <MaterialIcons name="add-shopping-cart" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Yeni Sipariş Test</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
    paddingTop: 60,
  },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "900", color: "#0f172a" },
  subtitle: { fontSize: 16, color: "#64748b", fontWeight: "bold" },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  orderInfo: { gap: 4 },
  orderId: { fontSize: 14, fontWeight: "bold", color: "#1e293b" },
  orderStatus: {
    color: "#74CF62",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  amount: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  addButton: {
    height: 60,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
