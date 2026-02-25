import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { supabase } from "../../lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isCompanyExpanded, setIsCompanyExpanded] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [vkn, setVkn] = useState("");

  const colors = {
    primary: "#74CF62",
    background: isDarkMode ? "#1a1a1a" : "#ffffff",
    text: isDarkMode ? "#ffffff" : "#0f172a",
    card: isDarkMode ? "#2d2d2d" : "#f8f9fa",
    border: isDarkMode ? "#444" : "#f1f5f9",
    muted: "#94a3b8",
  };

  const handleRegister = async () => {
    if (!name || !personalPhone || !password) {
      return Alert.alert(
        "Hata",
        "Lütfen Ad Soyad, Telefon ve Şifre alanlarını doldurun.",
      );
    }

    setLoading(true);

    try {
      const formattedPhone = personalPhone.replace(/\D/g, "");
      const fakeEmail = `${formattedPhone}@meydan.com`;

      // 1. ADIM: Auth Kaydı ve Metadata Gönderimi
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: password,
        options: {
          data: {
            full_name: name,
            phone: formattedPhone,
            is_company: isCompanyExpanded,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. ADIM: Şirket Bilgileri (Eğer seçilmişse)
        if (isCompanyExpanded) {
          const { error: companyError } = await supabase
            .from("companies")
            .upsert({
              user_id: authData.user.id,
              company_name: companyName,
              tax_number: vkn,
            });

          if (companyError) throw companyError;
        }

        // EKLEME: Kayıt sonrası doğrudan giriş yapabilmek için session kontrolü
        // Eğer Supabase panelinde "Confirm Email" kapalıysa authData.session dolu gelir.
        if (authData.session) {
          Alert.alert("Başarılı", "Kaydınız tamamlandı ve giriş yapıldı!");
          router.replace("/(tabs)/home");
        } else {
          // Eğer session yoksa e-posta onayı bekliyor demektir (Bu durumda login'e yönlendirilir)
          Alert.alert(
            "Kayıt Başarılı",
            "Lütfen giriş ekranından telefon numaranızla giriş yapın.",
          );
          router.replace("/auth/login");
        }
      }
    } catch (error: any) {
      Alert.alert("Kayıt Hatası", "Bir sorun oluştu: " + error.message);
      console.error("Hata Detayı:", error.message);
    } finally {
      setLoading(false);
    }
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
                placeholder="Ahmet Yılmaz"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
              />
            </View>
            <Text style={styles.label}>TELEFON</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="call" size={20} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="5XX XXX XX XX"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={personalPhone}
                onChangeText={setPersonalPhone}
              />
            </View>
            <Text style={styles.label}>ŞİFRE</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="lock" size={20} color={colors.muted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
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
                FİRMA BİLGİLERİ
              </Text>
            </TouchableOpacity>
            {isCompanyExpanded && (
              <View style={styles.companyForm}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingBottom: 10,
                    },
                  ]}
                  placeholder="Firma Adı"
                  placeholderTextColor={colors.muted}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
                <TextInput
                  style={[styles.input, { color: colors.text, paddingTop: 10 }]}
                  placeholder="VKN"
                  placeholderTextColor={colors.muted}
                  value={vkn}
                  onChangeText={setVkn}
                />
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0d1510" />
              ) : (
                <Text style={styles.submitText}>Kayıt Ol</Text>
              )}
            </TouchableOpacity>
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
  brand: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { fontSize: 36, fontWeight: "900" },
  divider: { height: 1, marginBottom: 30 },
  form: { gap: 15 },
  label: { fontSize: 10, fontWeight: "900", color: "#94a3b8", marginLeft: 5 },
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
  },
  submitBtn: {
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  submitText: { fontSize: 18, fontWeight: "900", color: "#0d1510" },
  toggleBg: { width: 48, height: 24, borderRadius: 12, padding: 2 },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
});
