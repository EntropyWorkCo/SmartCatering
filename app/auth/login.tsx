import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const handleLogin = async () => {
    // Boş alan kontrolü
    if (!phone || !password) {
      Alert.alert(
        "Eksik Bilgi",
        "Lütfen telefon numaranızı ve şifrenizi girin.",
      );
      return;
    }

    setLoading(true);

    try {
      // Normalizasyon: Boşlukları temizle, baştaki 0'ı at
      let formattedPhone = phone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
      }

      const loginEmail = `${formattedPhone}@meydan.com`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (error) throw error;

      if (data.session) {
        // Cihaz hafızasındaki admin yetkisini temizle (çakışmayı önlemek için)
        await AsyncStorage.removeItem("isAdmin");

        // Başarılı giriş durumunda (tabs) ana sayfasına yönlendir
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      // SENİN İSTEDİĞİN ÖZELLİK: Hata durumunda kayıt ol seçeneği sunan profesyonel Alert
      Alert.alert(
        "Giriş Başarısız",
        "Bu bilgilerle kayıtlı bir hesap bulunamadı veya bilgiler hatalı. Kayıt olmak ister misiniz?",
        [
          {
            text: "Vazgeç",
            style: "cancel",
          },
          {
            text: "Kayıt Ol",
            onPress: () => router.push("/auth/register"),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {/* Geri Butonu */}
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace("/welcome")}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <ThemeSwitcher />
          </View>

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
              <Text style={styles.label}>İLETİŞİM NUMARASI</Text>
              <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }]}>
                <Text style={{ fontSize: 16, color: colors.muted, fontWeight: 'bold', marginRight: 8 }}>+90</Text>
                <TextInput
                  style={{ flex: 1, height: '100%', fontSize: 16, color: colors.text }}
                  placeholder="5XX XXX XX XX"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.muted}
                  maxLength={10}
                  value={phone}
                  onChangeText={(text) => {
                    // Sayı olmayanları temizle ve baştaki 0'ı anında sil
                    let cleaned = text.replace(/\D/g, "");
                    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
                    setPhone(cleaned);
                  }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ŞİFRE</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.loginButtonText}>Giriş Yap</Text>
                  <MaterialIcons name="login" size={20} color={colors.background} />
                </View>
              )}
            </TouchableOpacity>

            {/* Ekrandaki Kayıt Ol Linki */}
            <TouchableOpacity
              onPress={() => router.push("/auth/register")}
              style={styles.registerLinkContainer}
            >
              <Text style={styles.linkText}>
                Henüz hesabınız yok mu?{" "}
                <Text style={styles.linkHighlight}>Kayıt Olun</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <MaterialIcons name="restaurant" size={16} color={colors.muted} />
            <Text style={styles.footerText}>MEYDAN LOKANTA v3.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 30, paddingBottom: 40, flexGrow: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  header: { marginBottom: 40 },
  brand: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: { fontSize: 36, fontWeight: "900", color: colors.text },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "bold", color: colors.text },
  form: { gap: 10 },
  inputGroup: { marginBottom: 15 },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 5,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  loginButton: {
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  loginButtonText: { fontSize: 16, fontWeight: "900", color: colors.background },
  registerLinkContainer: {
    marginTop: 25,
    alignItems: "center",
    paddingVertical: 10,
  },
  linkText: { fontSize: 15, color: colors.muted },
  linkHighlight: { fontWeight: "bold", color: colors.primary },
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
    color: colors.muted,
    letterSpacing: 2,
  },
});
