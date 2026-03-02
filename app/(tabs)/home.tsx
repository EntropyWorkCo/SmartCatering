import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Merhaba,</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Mevcut Bakiyeniz</Text>
          <Text style={styles.balanceAmount}>₺250.00</Text>
        </View>
        <Text style={styles.infoText}>
          Bugün Meydan Lokanta'da enfes bir menü seni bekliyor!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  welcomeText: { fontSize: 24, fontWeight: "bold", color: colors.text },
  balanceCard: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 20,
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  balanceLabel: { color: "#064e3b", fontWeight: "bold" },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#064e3b",
    marginTop: 5,
  },
  infoText: { marginTop: 20, color: colors.muted },
});
