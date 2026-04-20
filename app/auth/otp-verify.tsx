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
import { sendOtp, verifyOtp, registerUser } from "../../lib/services/authService";
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
    const address = params.address as string;
    
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
            const result = await verifyOtp(phone, code);
            if (!result || !result.success) {
                Alert.alert("Hatalı Kod", result?.error || "Girdiğiniz kod yanlış veya süresi dolmuş. Lütfen tekrar deneyin.");
                setLoading(false);
                return;
            }

            let basePhone = phone.replace(/[^0-9]/g, "");
            if (basePhone.startsWith("90") && basePhone.length > 10) basePhone = basePhone.slice(2);
            if (basePhone.startsWith("0")) basePhone = basePhone.slice(1);
            
            const effectivePhone = `+90${basePhone}`;

            if (mode === "register") {
                if (result.user_exists) {
                    Alert.alert("Bilgi", "Bu numara zaten kayıtlı. Lütfen giriş yapın.");
                    router.replace("/auth/login");
                    return;
                }

                const isCompany = role === "owner";

                // Güvenli kayıt: register-user edge function atomik olarak
                // auth.users + public.users oluşturur, generateLink+verifyOtp
                // ile gerçek session döner — fake email/password yok
                const regResult = await registerUser({
                    phone,
                    name,
                    role: role as 'owner' | 'individual' | 'employee',
                    companyName,
                    vkn,
                    address,
                });

                if (!regResult.success) {
                    Alert.alert("Kayıt Hatası", regResult.error || "Kayıt yapılamadı.");
                    setLoading(false);
                    return;
                }

                if (regResult.auto_login && regResult.access_token && regResult.refresh_token) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: regResult.access_token,
                        refresh_token: regResult.refresh_token,
                    });
                    if (sessionError) throw sessionError;
                    Alert.alert("Başarılı", "Hesabınız oluşturuldu!");
                    await triggerAuthRefresh();
                    router.replace("/(tabs)/home");
                } else {
                    Alert.alert("Başarılı", "Hesabınız oluşturuldu! Lütfen giriş yapın.");
                    router.replace("/auth/login");
                }
            } else {
                // LOGIN MODE
                if (!result.user_exists) {
                    Alert.alert("Kayıt Bulunamadı", "Bu numarayla eşleşen hesabınız bulunamadı. Lütfen kayıt olmayı deneyin.");
                    setLoading(false);
                    return;
                }

                // If role is employee, we need to check if they have a company_id
                // The edge function returned the user record!
                const existingUser = result.user;

                // Silinmiş hesap engeli
                if (existingUser?.role === 'deleted') {
                    Alert.alert("Hesap Silinmiş", "Bu hesap bağlı bulunduğu firma tarafından silinmiştir veya askıya alınmıştır. Giriş yapılamaz.");
                    setLoading(false);
                    return;
                }

                const isActuallyCompany = existingUser?.is_company === true 
                                        || existingUser?.role === 'owner' 
                                        || existingUser?.role === 'corporate';

                // Yetki Çapraz Giriş Engeli (Bireysel üyeler Kurumsal'dan, Kurumsallar Bireyselden giremesin)
                if (role === 'owner' && !isActuallyCompany) {
                    Alert.alert("Giriş Hatası", "Bu numara bireysel hesaba aittir. Firma sahibi girişi yapılamaz.");
                    setLoading(false);
                    return;
                }
                
                if (role === 'individual' && isActuallyCompany) {
                    Alert.alert("Giriş Hatası", "Bu numara kurumsal hesaba aittir. Lütfen Firma / Çalışan girişini kullanın.");
                    setLoading(false);
                    return;
                }
                if (role === 'employee') {
                    if (!existingUser?.company_id || !existingUser?.is_company) {
                        Alert.alert("Hata", "Firma kaydınız doğrulanamadı.");
                        setLoading(false);
                        return;
                    }

                    await AsyncStorage.setItem("softUser", JSON.stringify(existingUser));
                    
                    // We also need to set the session
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: result.access_token,
                        refresh_token: result.refresh_token,
                    });
                    
                    if (sessionError) throw sessionError;
                    
                    await triggerAuthRefresh();
                    router.replace("/(tabs)/home");
                    return;
                }

                // Normal Login (Owner/Individual) - use Edge Function's tokens directly
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: result.access_token,
                    refresh_token: result.refresh_token,
                });

                if (sessionError) {
                    Alert.alert("Giriş Başarısız", "Oturum oluşturulamadı: " + sessionError.message);
                    setLoading(false);
                    return;
                }

                await triggerAuthRefresh();
                router.replace("/(tabs)/home");
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
