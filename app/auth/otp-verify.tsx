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
import { verifyOtp } from "../../lib/services/authService";
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
                Alert.alert("Hatalı Kod", "Girdiğiniz kod yanlış. Test modunda cevap: '123456' dır.");
                setLoading(false);
                return;
            }

            // --- Gerçek OTP (SMS servisi tam gelene dek) Doğrulandı, İşlemlere Başla ---
            const fakeEmail = `${phone}@meydan.com`;

            if (mode === "register") {
                // YENİ KAYIT İŞLEMİ
                const isCompany = role === "owner";
                
                // Kayıtlar için şifreyi geçici olarak statik tutuyoruz arka planda, kullanıcıya şifre sorulmuyor.
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: fakeEmail,
                    password: `${phone}OtpPassword!`, // Gelecekte sadece custom provider'lı Phone login'e çevrilebilir (Supabase Phone Auth hazır olduğunda)
                    options: {
                        data: {
                            full_name: name,
                            phone: phone,
                            is_company: isCompany,
                            role: role,
                        },
                    },
                });

                if (authError) throw authError;

                if (authData.user && isCompany) {
                    const { error: companyError } = await supabase
                        .from("companies")
                        .upsert({
                            user_id: authData.user.id,
                            company_name: companyName,
                            tax_number: vkn,
                        });

                    if (companyError) throw companyError;
                }

                if (authData.session) {
                    Alert.alert("Başarılı", "Hesabınız oluşturuldu!");
                    await AsyncStorage.removeItem("isAdmin");
                    router.replace("/(tabs)/home");
                } else {
                    Alert.alert("Hata", "Oturum açılamadı. Lütfen giriş yapmayı deneyin.");
                    router.replace("/auth/login");
                }
            } else {
                // GİRİŞ PENCERESİ
                if (role === 'employee') {
                    const { data: empUser, error: empError } = await supabase
                        .from("users")
                        .select("*")
                        .eq("phone", phone)
                        .single();

                    if (empError || !empUser) {
                        Alert.alert(
                            "Kayıt Bulunamadı",
                            "Firma sahibiniz tarafından sisteme eklenmemişsiniz. Lütfen eklemesini isteyin."
                        );
                        setLoading(false);
                        return;
                    }

                    await AsyncStorage.setItem("softUser", JSON.stringify(empUser));
                    await AsyncStorage.removeItem("isAdmin");
                    router.replace("/(tabs)/home");
                    return;
                }

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: fakeEmail,
                    password: `${phone}OtpPassword!`, 
                });

                if (error) {
                    Alert.alert(
                        "Kayıt Bulunamadı",
                        "Bu numarayla eşleşen hesabınız bulunamadı. Lütfen ilgili sekmeden kayıt olmayı deneyin."
                    );
                    setLoading(false);
                    return;
                }

                if (data.session) {
                    await AsyncStorage.removeItem("isAdmin");
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
                            +90 {phone} numarasına SMS olarak gelen 6 haneli kodu giriniz.
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
                        onPress={() => Alert.alert("Bilgi (Prototip)", "Kod test amaçlı '123456' olarak belirlenmiştir.")}
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
