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

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function RegisterScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isCompanyExpanded, setIsCompanyExpanded] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [vkn, setVkn] = useState("");

  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const handleRegister = async () => {
    if (!name || !personalPhone || !password) {
      return Alert.alert(
        "Hata",
        "Lütfen Ad Soyad, Telefon ve Şifre alanlarını doldurun.",
      );
    }

    if (isCompanyExpanded && (!companyName.trim() || !vkn.trim())) {
      return Alert.alert(
        "Eksik Bilgi",
        "Lütfen Firma Adı ve VKN alanlarını doldurun veya Firma Bilgileri bölümünü kapatın.",
      );
    }

    setLoading(true);

    try {
      // Normalizasyon: Boşlukları temizle, baştaki 0'ı at
      let formattedPhone = personalPhone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
      }

      if (formattedPhone.length !== 10 || !formattedPhone.startsWith("5")) {
        setLoading(false);
        return Alert.alert(
          "Geçersiz Numara",
          "Lütfen telefon numaranızı başında 0 olmadan, 5 ile başlayacak şekilde (10 hane) girin."
        );
      }

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <View>
                <Text style={styles.brand}>MEYDAN LOKANTA</Text>
                <Text style={styles.title}>Kayıt Ol</Text>
              </View>
            </View>
            <ThemeSwitcher />
          </View>

          <View style={styles.divider} />

          <View style={styles.form}>
            <Text style={styles.label}>AD SOYAD</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person" size={20} color={colors.muted} />
              <TextInput
                style={styles.input}
                placeholder="Ahmet Yılmaz"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={styles.label}>TELEFON</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="call" size={20} color={colors.muted} />
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 16, color: colors.muted, fontWeight: 'bold', marginRight: 5 }}>+90</Text>
                <TextInput
                  style={[styles.input, { marginLeft: 0 }]}
                  placeholder="5XX XXX XX XX"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={personalPhone}
                  onChangeText={(text) => {
                    // Sayı olmayanları temizle ve baştaki 0'ı anında sil
                    let cleaned = text.replace(/\D/g, "");
                    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
                    setPersonalPhone(cleaned);
                  }}
                />
              </View>
            </View>

            <Text style={styles.label}>ŞİFRE</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color={colors.muted} />
              <TextInput
                style={styles.input}
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
              <Text style={styles.accordionTitle}>FİRMA BİLGİLERİ</Text>
            </TouchableOpacity>

            {isCompanyExpanded && (
              <View style={styles.companyForm}>
                <TextInput
                  style={[styles.input, { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, paddingBottom: 10 }]}
                  placeholder="Firma Adı"
                  placeholderTextColor={colors.muted}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
                <TextInput
                  style={[styles.input, { paddingTop: 10 }]}
                  placeholder="VKN"
                  placeholderTextColor={colors.muted}
                  value={vkn}
                  onChangeText={setVkn}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
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

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 30, flexGrow: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", gap: 15, alignItems: 'center' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  brand: { fontSize: 10, fontWeight: "900", letterSpacing: 2, color: colors.primary },
  title: { fontSize: 36, fontWeight: "900", color: colors.text },
  divider: { height: 1, marginBottom: 30, backgroundColor: colors.surfaceBorder },
  form: { gap: 15 },
  label: { fontSize: 10, fontWeight: "900", color: colors.muted, marginLeft: 5 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  accordionTitle: { fontSize: 14, fontWeight: "900", color: colors.primary },
  companyForm: {
    gap: 15,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 15,
  },
  submitBtn: {
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: colors.primary,
  },
  submitText: { fontSize: 18, fontWeight: "900", color: colors.background },
});
