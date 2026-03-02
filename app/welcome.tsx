import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ThemeSwitcher />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="restaurant-menu" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>
            Lütfen devam etmek için giriş tipini seçin
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/auth/login?type=customer")}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.cardHighlight }]}>
              <MaterialIcons name="person-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Müşteri Girişi</Text>
              <Text style={styles.cardDesc}>GÜNLÜK MENÜ & TAKİP</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.tabIconDefault} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/auth/admin-login")}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
              <MaterialIcons
                name="admin-panel-settings"
                size={28}
                color={colors.muted}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Yönetici Girişi</Text>
              <Text style={styles.cardDesc}>MENÜ YÖNETİMİ & PANELLER</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.tabIconDefault} />
          </TouchableOpacity>
        </View>

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

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: 24, paddingTop: 12, alignItems: 'flex-end' },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 60 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center" },
  buttonsContainer: { gap: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
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
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  footer: { marginTop: "auto", alignItems: "center", paddingTop: 40 },
  footerBrand: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.tabIconDefault,
    letterSpacing: 2,
    marginBottom: 4,
  },
  footerLogo: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
  },
  footerDesc: { fontSize: 10, color: colors.muted, marginTop: 4 },
});
