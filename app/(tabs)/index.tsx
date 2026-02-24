import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
// SafeAreaView uyarısını çözmek için react-native-safe-area-context kullanıyoruz
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo ve Başlık */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="restaurant-menu" size={40} color="#74CF62" />
          </View>
          <Text style={styles.title}>Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>
            Lütfen devam etmek için giriş tipini seçin
          </Text>
        </View>

        {/* Butonlar */}
        <View style={styles.buttonsContainer}>
          {/* Müşteri Girişi */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/auth/login?type=customer")}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: "#e8f5e9" }]}>
              <MaterialIcons name="person-outline" size={28} color="#2e7d32" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Müşteri Girişi</Text>
              <Text style={styles.cardDesc}>GÜNLÜK MENÜ & TAKİP</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>

          {/* Yönetici Girişi Butonu */}
          <TouchableOpacity
            style={styles.card}
            // BURAYI DEĞİŞTİR: "/auth/login" yerine direkt "/auth/admin-login" yapıyoruz
            onPress={() => router.push("/auth/admin-login")}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: "#f8f9fa" }]}>
              <MaterialIcons
                name="admin-panel-settings"
                size={28}
                color="#334155"
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Yönetici Girişi</Text>
              <Text style={styles.cardDesc}>MENÜ YÖNETİMİ & PANELLER</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Alt Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>KURUMSAL</Text>
          <Text style={styles.footerLogo}>MEYDAN LOKANTA</Text>
          <Text style={styles.footerDesc}>
            Catering & Cafeteria Management v2.0
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 60 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24, // Hatalı olan satır burasıydı, düzelttik
  },
  title: { fontSize: 28, fontWeight: "900", color: "#0f172a", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center" },
  buttonsContainer: { gap: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  footer: { marginTop: "auto", alignItems: "center", paddingTop: 40 },
  footerBrand: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#cbd5e1",
    letterSpacing: 2,
    marginBottom: 4,
  },
  footerLogo: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 1,
  },
  footerDesc: { fontSize: 10, color: "#94a3b8", marginTop: 4 },
});
