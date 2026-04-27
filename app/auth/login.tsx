import Logo from "@/components/Logo";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
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
import { normalizePhone, sendOtp } from "../../lib/services/authService";
import { supabase } from "../../lib/supabase";

type TabType = 'owner' | 'employee' | 'individual';
type ModeType = 'login' | 'register';

export default function LoginTabsScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [activeTab, setActiveTab] = useState<TabType>('owner');
    const [mode, setMode] = useState<ModeType>('login'); // Sadece Owner ve Individual için Register var
    const [loading, setLoading] = useState(false);

    // Form States
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [vkn, setVkn] = useState("");
    const [address, setAddress] = useState("");

    // Sekme Değiştiğinde Formu Temizle
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setPhone("");
        setName("");
        setCompanyName("");
        setVkn("");
        setAddress("");
        if (tab === 'employee') {
            setMode('login'); // Çalışan sadece giriş yapabilir
        }
    };

    const handleAction = async () => {
        const cleanPhone = normalizePhone(phone);
        if (!cleanPhone) {
            Alert.alert("Geçersiz Numara", "Lütfen 10 haneli (5xx) telefon numaranızı girin.");
            return;
        }

        if (mode === 'register') {
            if (!name.trim()) return Alert.alert("Hata", "Lütfen ad soyad giriniz.");
            if (activeTab === 'owner' && (!companyName.trim() || !vkn.trim())) {
                return Alert.alert("Hata", "Lütfen firma adı ve VKN giriniz.");
            }
            if (activeTab === 'owner' && (vkn.length !== 10 && vkn.length !== 11)) {
                return Alert.alert("Geçersiz VKN/TCKN", "VKN 10 hane, TCKN 11 hane olmalıdır.");
            }
        }

        setLoading(true);

        try {
            // ŞİMDİ SADECE OTP GÖNDER - Login veya Register ayrımı OTP doğrulandıktan sonra 'otp-verify.tsx' içinde yapılacak.
            // Fakat Login işlemi için önce bu numaranın sistemde kayıtlı olup olmadığını (Supabase) kontrol etsek iyi olur.
            // (Güvenli yaklaşım: Phone Auth olmadığı için email üzerinden dummy check)

            // OTP GÖNDERME
            const otpSent = await sendOtp(cleanPhone);
            
            if (otpSent) {
                // Yönlendirme
                router.push({
                    pathname: "/auth/otp-verify",
                    params: {
                        phone: cleanPhone,
                        mode: mode,
                        role: activeTab,
                        name: mode === 'register' ? name : '',
                        companyName: mode === 'register' && activeTab === 'owner' ? companyName : '',
                        vkn: mode === 'register' && activeTab === 'owner' ? vkn : '',
                        address: mode === 'register' ? address : '',
                    }
                });
            } else {
                Alert.alert("Hata", "OTP kodu gönderilemedi. Lütfen tekrar deneyin.");
            }

        } catch (error: any) {
            Alert.alert("Hata", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* Üst Kısım */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/welcome")} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <ThemeSwitcher />
                    </View>

                    <Logo size="medium" style={{ alignSelf: 'flex-start', marginBottom: 20 }} />
                    <Text style={styles.title}>Kullanıcı Girişi</Text>

                    {/* Sekmeler (Tabs) */}
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'owner' && styles.activeTab]} 
                            onPress={() => handleTabChange('owner')}
                        >
                            <Text style={[styles.tabText, activeTab === 'owner' && styles.activeTabText]}>Firma Sahibi</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'employee' && styles.activeTab]} 
                            onPress={() => handleTabChange('employee')}
                        >
                            <Text style={[styles.tabText, activeTab === 'employee' && styles.activeTabText]}>Çalışan</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'individual' && styles.activeTab]} 
                            onPress={() => handleTabChange('individual')}
                        >
                            <Text style={[styles.tabText, activeTab === 'individual' && styles.activeTabText]}>Bireysel</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Alanı */}
                    <View style={styles.formContainer}>
                        
                        {/* Ortak Alan: Telefon Numarası */}
                        <Text style={styles.label}>TELEFON NUMARASI</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.prefix}>+90</Text>
                            <TextInput
                                style={styles.inputPhone}
                                placeholder="5XX XXX XX XX"
                                keyboardType="phone-pad"
                                placeholderTextColor={colors.muted}
                                maxLength={10}
                                value={phone}
                                onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                            />
                        </View>

                        {/* Sadece Kayıt (Register) Durumunda Gözükecek Ek Alanlar */}
                        {mode === 'register' && (
                            <View style={styles.registerFields}>
                                <Text style={styles.label}>AD SOYAD</Text>
                                <View style={styles.inputWrapper}>
                                    <MaterialIcons name="person" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={styles.inputText}
                                        placeholder="Adınız ve Soyadınız"
                                        placeholderTextColor={colors.muted}
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>

                                {activeTab === 'owner' && (
                                    <>
                                        <Text style={styles.label}>FİRMA ADI</Text>
                                        <View style={styles.inputWrapper}>
                                            <MaterialIcons name="business" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                            <TextInput
                                                style={styles.inputText}
                                                placeholder="Şirketinizin Adı"
                                                placeholderTextColor={colors.muted}
                                                value={companyName}
                                                onChangeText={setCompanyName}
                                            />
                                        </View>

                                        <Text style={styles.label}>VERGİ KİMLİK NO (VKN/TCKN)</Text>
                                        <View style={styles.inputWrapper}>
                                            <MaterialIcons name="tag" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                            <TextInput
                                                style={styles.inputText}
                                                placeholder="10 veya 11 Haneli Numara"
                                                keyboardType="number-pad"
                                                placeholderTextColor={colors.muted}
                                                value={vkn}
                                                onChangeText={setVkn}
                                            />
                                        </View>
                                    </>
                                )}

                                <Text style={styles.label}>AÇIK ADRES</Text>
                                <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 15 }]}>
                                    <MaterialIcons name="location-on" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={[styles.inputText, { height: '100%', textAlignVertical: 'top' }]}
                                        placeholder="Siparişleriniz için açık adres (Opsiyonel)"
                                        placeholderTextColor={colors.muted}
                                        multiline
                                        value={address}
                                        onChangeText={setAddress}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Aksiyon Butonu */}
                        <TouchableOpacity
                            style={[styles.actionButton, loading && { opacity: 0.7 }]}
                            onPress={handleAction}
                            disabled={loading || phone.length < 10}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.background} />
                            ) : (
                                <Text style={styles.actionButtonText}>
                                    {mode === 'login' ? 'Giriş Yap (SMS Kodu Al)' : 'Kayıt Ol ve Onayla'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Giriş / Kayıt Arası Geçiş (Geçiş Yalnızca Çalışan Sekmesinde Yoktur) */}
                        {activeTab !== 'employee' && (
                            <TouchableOpacity style={styles.toggleModeButton} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
                                <Text style={styles.toggleModeText}>
                                    {mode === 'login' 
                                        ? "Hesabınız yok mu? Yeni Kayıt Oluşturun." 
                                        : "Zaten kayıtlı mısınız? Giriş Yapın."}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {activeTab === 'employee' && (
                            <Text style={styles.employeeInfoText}>
                                Firma çalışanlarının kaydı firma sahipleri tarafından yapılmaktadır. Sadece sisteme kayıtlı telefon numaranızla giriş yapabilirsiniz.
                            </Text>
                        )}
                        
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 30, paddingBottom: 40, flexGrow: 1, paddingTop: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: colors.surfaceBorder,
    },
    brand: { fontSize: 10, fontWeight: "900", color: colors.primary, letterSpacing: 2, marginBottom: 5 },
    title: { fontSize: 32, fontWeight: "900", color: colors.text, marginBottom: 30 },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    tabText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.muted,
    },
    activeTabText: {
        color: colors.background,
    },
    formContainer: { gap: 10 },
    label: { fontSize: 11, fontWeight: "900", color: colors.muted, letterSpacing: 1, marginTop: 15, marginBottom: 5 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderWidth: 2,
        borderColor: colors.surfaceBorder,
        borderRadius: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
    },
    prefix: { fontSize: 18, color: colors.text, fontWeight: '900', marginRight: 10 },
    inputPhone: { flex: 1, height: '100%', fontSize: 18, color: colors.text, fontWeight: 'bold', letterSpacing: 2 },
    inputText: { flex: 1, height: '100%', fontSize: 16, color: colors.text, fontWeight: '600' },
    registerFields: { gap: 0 }, // Gaps are handled by labels and inputWrappers
    actionButton: {
        height: 60,
        backgroundColor: colors.primary,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20,
    },
    actionButtonText: { fontSize: 16, fontWeight: "900", color: colors.background },
    toggleModeButton: { marginTop: 25, alignItems: "center", padding: 10 },
    toggleModeText: { fontSize: 14, fontWeight: "bold", color: colors.text, textDecorationLine: "underline" },
    employeeInfoText: {
        marginTop: 20,
        fontSize: 13,
        color: colors.muted,
        textAlign: 'center',
        lineHeight: 20,
        fontStyle: 'italic',
        paddingHorizontal: 10
    }
});
