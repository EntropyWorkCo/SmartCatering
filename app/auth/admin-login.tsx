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
// Backend Servislerimiz
import { userService } from "../../lib/services/userService";
import { supabase } from "../../lib/supabase";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const handleLogin = async () => {
    // 1. BOŞ ALAN KONTROLÜ
    if (!email || !code) {
      Alert.alert("Eksik Bilgi", "Lütfen e-posta ve erişim kodunu girin.");
      return;
    }

    setLoading(true);
    console.log("LOG: Giriş denemesi başlatıldı...", email);

    try {
      // 2. SUPABASE AUTH GİRİŞİ
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email,
          password: code,
        },
      );

      if (authError) {
        console.error("LOG: Auth Hatası:", authError.message);
        throw authError;
      }

      console.log("LOG: Auth başarılı, admin yetkisi kontrol ediliyor...");

      // 3. ADMİN YETKİSİ KONTROLÜ (RPC ÇAĞRISI)
      const isAdminCheck = await userService.checkIsAdmin();
      console.log("LOG: Veritabanı Admin Cevabı:", isAdminCheck);

      if (isAdminCheck === true) {
        console.log("LOG: Yetki onaylandı! Dashboard'a yönlendiriliyor...");

        // ÖNEMLİ: Expo Router bazen parantezli klasörlerde hassas olabilir.
        // Eğer yönlenmezse burayı "/dashboard" olarak değiştirebiliriz.
        router.replace("/(admin)/dashboard");
      } else {
        console.warn("LOG: Yetki reddedildi! Kullanıcı admin değil.");
        await supabase.auth.signOut();
        Alert.alert(
          "Yetki Reddedildi",
          "Bu hesapla yönetici paneline giriş yapamazsınız. Lütfen rolünüzü kontrol edin.",
        );
      }
    } catch (err: any) {
      console.error("LOG: Genel Hata:", err.message);
      Alert.alert("Giriş Başarısız", err.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          {/* Geri Butonu */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <ThemeSwitcher />
        </View>

        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>M</Text>
          </View>

          {/* Başlıklar */}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>YÖNETİCİ PANELİ GİRİŞİ</Text>
          </View>

          {/* Giriş Formu */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Yönetici E-posta"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { letterSpacing: 2 }]}
                placeholder="Erişim Kodu"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={code}
                onChangeText={setCode}
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#064e3b" />
              ) : (
                <Text style={styles.loginButtonText}>OTURUM AÇ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            MEYDAN LOKANTA v3.0 PROFESSIONAL
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: colors.primary,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  logoText: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    fontStyle: "italic",
  },
  headerTextContainer: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, marginBottom: 6 },
  subtitle: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 3,
  },
  form: { width: "100%", maxWidth: 320, gap: 14 },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  input: { padding: 18, fontSize: 15, fontWeight: "600", color: colors.text },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: { color: "#064e3b", fontSize: 16, fontWeight: "900" },
  footer: { marginTop: 40, alignItems: "center", opacity: 0.4 },
  footerText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 2,
  },
});
