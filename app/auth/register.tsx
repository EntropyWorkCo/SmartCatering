import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
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

export default function RegisterScreen() {
  const router = useRouter();

  // State tanımlamaları
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [name, setName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [isCompanyExpanded, setIsCompanyExpanded] = useState(false);

  // Firma bilgileri state
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [vkn, setVkn] = useState("");

  const colors = {
    primary: "#74CF62",
    background: isDarkMode ? "#1a1a1a" : "#ffffff",
    text: isDarkMode ? "#ffffff" : "#0f172a",
    card: isDarkMode ? "#2d2d2d" : "#f8f9fa",
    border: isDarkMode ? "#444" : "#f1f5f9",
    muted: "#94a3b8",
  };

  const handleRegister = () => {
    if (!name || !personalPhone) {
      return Alert.alert(
        "Hata",
        "Lütfen Ad Soyad ve Kişisel İletişim Numarası alanlarını doldurun.",
      );
    }

    if (isCompanyExpanded && (!companyName || !companyPhone || !vkn)) {
      return Alert.alert("Hata", "Lütfen tüm firma bilgilerini doldurun.");
    }

    Alert.alert("Başarılı", "Kaydınız oluşturuldu!");
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Bölümü */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: colors.card }]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <View>
                <Text style={[styles.brand, { color: colors.primary }]}>
                  MEYDAN LOKANTA
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  Kayıt Ol
                </Text>
              </View>
            </View>

            {/* Dark Mode Toggle */}
            <TouchableOpacity
              onPress={() => setIsDarkMode(!isDarkMode)}
              style={[
                styles.toggleBg,
                { backgroundColor: isDarkMode ? colors.primary : "#e2e8f0" },
              ]}
            >
              <View
                style={[
                  styles.toggleCircle,
                  { transform: [{ translateX: isDarkMode ? 24 : 0 }] },
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Form Alanı */}
          <View style={styles.form}>
            <Text style={styles.label}>AD SOYAD</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="person" size={20} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Örn: Ahmet Yılmaz"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={styles.label}>KİŞİSEL İLETİŞİM NUMARASI</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="call" size={20} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="(5XX) XXX XX XX"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={personalPhone}
                onChangeText={setPersonalPhone}
              />
            </View>

            {/* Firma Bilgileri Accordion */}
            <TouchableOpacity
              onPress={() => setIsCompanyExpanded(!isCompanyExpanded)}
              style={styles.accordionHeader}
            >
              <MaterialIcons
                name={isCompanyExpanded ? "expand-less" : "expand-more"}
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.accordionTitle, { color: colors.primary }]}>
                FİRMA BİLGİLERİNİ EKLE
              </Text>
            </TouchableOpacity>

            {isCompanyExpanded && (
              <View style={styles.companyForm}>
                <Text style={styles.label}>FİRMA ADI / KODU</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialIcons name="domain" size={20} color={colors.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Örn: ABC Lojistik"
                    placeholderTextColor={colors.muted}
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                </View>

                <Text style={styles.label}>FİRMA İLETİŞİM NUMARASI</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialIcons name="call" size={20} color={colors.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="(5XX) XXX XX XX"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    value={companyPhone}
                    onChangeText={setCompanyPhone}
                  />
                </View>

                <Text style={styles.label}>VERGİ KİMLİK NO</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialIcons name="work" size={20} color={colors.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="10 haneli VKN"
                    placeholderTextColor={colors.muted}
                    value={vkn}
                    onChangeText={setVkn}
                  />
                </View>
              </View>
            )}

            {/* Submit Butonu */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleRegister}
            >
              <Text style={styles.submitText}>Kayıt Ol</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#0d1510" />
            </TouchableOpacity>

            <Text style={styles.legalText}>
              Kayıt olarak kurumsal yemek hizmeti kullanım şartlarını kabul
              etmiş olursunuz.
            </Text>

            <View style={styles.footerNav}>
              <Text style={{ color: colors.muted }}>
                Zaten bir hesabınız var mı?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                  Giriş Yapın
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logo Footer */}
          <View style={styles.logoFooter}>
            <MaterialIcons
              name="restaurant"
              size={24}
              color={isDarkMode ? "#fff" : "#0d1510"}
            />
            <Text
              style={[
                styles.footerBrand,
                { color: isDarkMode ? "#fff" : "#0d1510" },
              ]}
            >
              MEYDAN
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 30, flexGrow: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", gap: 15 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 5 },
  title: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  divider: { height: 1, width: "100%", marginBottom: 30 },
  form: { gap: 15 },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 1.5,
    marginLeft: 5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  accordionTitle: { fontSize: 14, fontWeight: "900" },
  companyForm: {
    gap: 15,
    borderLeftWidth: 2,
    borderLeftColor: "#74CF62",
    paddingLeft: 15,
    marginVertical: 10,
  },
  submitBtn: {
    flexDirection: "row",
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  submitText: { fontSize: 18, fontWeight: "900", color: "#0d1510" },
  legalText: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  footerNav: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  logoFooter: {
    marginTop: "auto",
    paddingVertical: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    opacity: 0.3,
  },
  footerBrand: { fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  toggleBg: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
});
