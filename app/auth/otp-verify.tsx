import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { triggerAuthRefresh } from "@/lib/hooks/useAuth";
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
import { verifyOtp, sendOtp } from "../../lib/services/authService";
import { supabase } from "../../lib/supabase";

export default function OtpVerifyScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const phone = params.phone as string;
    const mode = params.mode as string; // 'login' veya 'register'
    const role = params.role as string; // 'owner' | 'employee' | 'individual'
    
    // Sadece register ise gelecek parametreler
    const name = params.name as string;
    const companyName = params.companyName as string;
    const vkn = params.vkn as string;
    
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    // Kod Doğrulama Tetiklemesi
    const handleVerify = async () => {
        if (code.length !== 6) {
            Alert.alert("Eksik Kod", "Lütfen 6 haneli doğrulama kodunu girin.");
            return;
        }

        setLoading(true);

        try {
            const isMatch = await verifyOtp(phone, code);
            if (!isMatch) {
                Alert.alert("Hatalı Kod", "Girdiğiniz kod yanlış veya süresi dolmuş. Lütfen tekrar deneyin.");
                setLoading(false);
                return;
            }

            // --- Gerçek OTP (SMS servisi tam gelene dek) Doğrulandı, İşlemlere Başla ---
            // --- Akıllı Telefon Eşleştirme (Migration Support) ---
            const clean10 = phone.replace(/\D/g, "").slice(-10); // Son 10 hane (5XXXXXXXXX)
            const clean0 = `0${clean10}`; // 0 ile başlayan (05XXXXXXXXX)
            const cleanPlus90 = `+90${clean10}`; // Tam format (+905XXXXXXXXX)

            // Önce bu numaraya sahip bir kullanıcı var mı (herhangi bir formatta) ona bakalım
            const { data: existingUser } = await supabase
                .from("users")
                .select("*")
                .or(`phone.eq."${clean10}",phone.eq."${clean0}",phone.eq."${cleanPlus90}"`)
                .maybeSingle();

            // Eğer kullanıcı bulunduysa, sistemdeki kayıtlı numarasını (ve formatını) kullanalım
            const effectivePhone = existingUser ? existingUser.phone : cleanPlus90;
            const fakeEmail = `${effectivePhone}@meydan.com`;

            if (mode === "register") {
                // KAYIT İŞLEMİ (Eğer kullanıcı zaten varsa login'e yönlendirilmeli ama OtpVerifyScreen genelde buna gelmez)
                if (existingUser) {
                    Alert.alert("Bilgi", "Bu numara zaten kayıtlı. Lütfen giriş yapın.");
                    router.replace("/auth/login");
                    return;
                }

                const isCompany = role === "owner";
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: fakeEmail,
                    password: `${effectivePhone}OtpPassword!`, // Şifre kayıtlı numara formatıyla eşleşmeli
                    options: {
                        data: {
                            full_name: name,
                            phone: effectivePhone, // Veritabanına yeni standart (+90) ile kaydedilecek
                            is_company: isCompany,
                            role: role,
                        },
                    },
                });

                if (authError) throw authError;

                if (authData.user && isCompany) {
                    await supabase.from("companies").upsert({
                        user_id: authData.user.id,
                        company_name: companyName,
                        tax_number: vkn,
                    });
                }

                if (authData.session) {
                    Alert.alert("Başarılı", "Hesabınız oluşturuldu!");
                    router.replace("/(tabs)/home");
                } else {
                    router.replace("/auth/login");
                }
            } else {
                // GİRİŞ PENCERESİ
                if (!existingUser) {
                    Alert.alert("Kayıt Bulunamadı", "Bu numarayla eşleşen hesabınız bulunamadı. Lütfen kayıt olmayı deneyin.");
                    setLoading(false);
                    return;
                }

                if (role === 'employee') {
                    // Çalışan kontrolü (Zaten existingUser içinde company_id olmalı)
                    if (!existingUser.company_id || !existingUser.is_company) {
                        Alert.alert("Hata", "Firma kaydınız doğrulanamadı.");
                        setLoading(false);
                        return;
                    }

                    await AsyncStorage.setItem("softUser", JSON.stringify(existingUser));
                    await triggerAuthRefresh();
                    router.replace("/(tabs)/home");
                    return;
                }

                // Owner veya Individual için Auth Girişi
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: `${effectivePhone}OtpPassword!`, 
                });

                if (error) {
                    Alert.alert("Giriş Başarısız", "Şifre veya kullanıcı formatı hatası. Lütfen tekrar deneyin.");
                    setLoading(false);
                    return;
                }

                if (data.session) {
                    await triggerAuthRefresh();
                    router.replace("/(tabs)/home");
                }
            }
        } catch (error: any) {
            Alert.alert("Hata Oluştu", error.message);
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
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                        >
                            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <ThemeSwitcher />
                    </View>

                    <View style={{ marginBottom: 40, alignItems: 'center' }}>
                        <MaterialIcons name="sms" size={48} color={colors.primary} style={{ marginBottom: 20 }} />
                        <Text style={styles.title}>Doğrulama Kodu</Text>
                        <Text style={styles.subtitle}>
                            {phone} numarasına SMS olarak gelen 6 haneli kodu giriniz.
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="X X X X X X"
                            keyboardType="number-pad"
                            maxLength={6}
                            placeholderTextColor={colors.muted}
                            value={code}
                            onChangeText={setCode}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.verifyButton, loading && { opacity: 0.7 }]}
                        onPress={handleVerify}
                        disabled={loading || code.length < 6}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <Text style={styles.verifyButtonText}>Onayla</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.resendButton}
                        onPress={async () => {
                            setLoading(true);
                            const success = await sendOtp(phone);
                            setLoading(false);
                            if (success) {
                                Alert.alert("Başarılı", "Yeni doğrulama kodu numaraya tekrar gönderildi.");
                            } else {
                                Alert.alert("Hata", "Mevcut ayarlarınızla kod gönderilemedi. Lütfen teknik logları kontrol edin.");
                            }
                        }}
                    >
                        <Text style={styles.resendText}>Kodu Tekrar Gönder</Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 30, paddingBottom: 40, flexGrow: 1, paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
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
    title: { fontSize: 28, fontWeight: "900", color: colors.text, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
    inputGroup: { marginBottom: 30 },
    input: {
        height: 60,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 24,
        letterSpacing: 10,
        color: colors.text,
        backgroundColor: colors.surface,
        textAlign: 'center',
        fontWeight: 'bold'
    },
    verifyButton: {
        height: 60,
        backgroundColor: colors.primary,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    verifyButtonText: { fontSize: 18, fontWeight: "900", color: colors.background },
    resendButton: { marginTop: 25, alignItems: "center" },
    resendText: { fontSize: 14, fontWeight: "bold", color: colors.primary, textDecorationLine: "underline" },
});
