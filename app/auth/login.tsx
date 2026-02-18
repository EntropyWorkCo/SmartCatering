import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// BURASI ÇOK ÖNEMLİ: "export default" olmazsa Expo sayfayı tanımaz!
export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.brand}>MEYDAN LOKANTA</Text>
            <Text style={styles.title}>Giriş Yap</Text>
            {params.type === "admin" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>YÖNETİCİ MODU</Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>AD SOYAD</Text>
              <TextInput
                style={styles.input}
                placeholder="Ahmet Yılmaz"
                placeholderTextColor="#cbd5e1"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>İLETİŞİM NUMARASI</Text>
              <TextInput
                style={styles.input}
                placeholder="(5XX) XXX XX XX"
                keyboardType="phone-pad"
                placeholderTextColor="#cbd5e1"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.divider}>
              <MaterialIcons name="business" size={20} color="#74CF62" />
              <Text style={styles.dividerText}>Firma ile Giriş Yap</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>FİRMA ADI / KODU</Text>
              <TextInput
                style={styles.input}
                placeholder="Firma adını veya kodunu girin"
                placeholderTextColor="#cbd5e1"
                value={companyCode}
                onChangeText={setCompanyCode}
              />
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.replace("/(tabs)")}
            >
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
              <MaterialIcons name="login" size={20} color="#064e3b" />
            </TouchableOpacity>

            <View style={styles.registerLink}>
              <Text style={styles.linkText}>Henüz hesabınız yok mu? </Text>
              <TouchableOpacity onPress={() => router.push("/auth/register")}>
                <Text style={styles.linkHighlight}>Kayıt Olun</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <MaterialIcons name="restaurant" size={16} color="#cbd5e1" />
            <Text style={styles.footerText}>MEYDAN</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 30, flexGrow: 1 },
  header: { marginBottom: 40, marginTop: 20 },
  brand: {
    fontSize: 10,
    fontWeight: "900",
    color: "#74CF62",
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: { fontSize: 36, fontWeight: "900", color: "#0f172a" },
  badge: {
    backgroundColor: "#f1f5f9",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "bold", color: "#64748b" },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 1,
    marginLeft: 4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#fcfcfc",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dividerText: { fontSize: 14, fontWeight: "bold", color: "#74CF62" },
  loginButton: {
    height: 60,
    backgroundColor: "#74CF62",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  loginButtonText: { fontSize: 16, fontWeight: "900", color: "#064e3b" },
  registerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  linkText: { fontSize: 12, color: "#94a3b8" },
  linkHighlight: { fontSize: 12, fontWeight: "bold", color: "#74CF62" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: "auto",
    paddingTop: 40,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#cbd5e1",
    letterSpacing: 2,
  },
});
