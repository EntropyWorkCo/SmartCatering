import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { userService } from "@/lib/services/userService";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function AccountInfoScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile, loading } = useProfile(user?.id);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setPhone(profile.phone || "");
            setAddress(profile.address || "");
        }
    }, [profile]);

    const handlePhoneChange = (text: string) => {
        // Sadece rakamları al
        let cleaned = text.replace(/[^0-9]/g, "");

        // Başta 0 varsa sil
        if (cleaned.startsWith("0")) {
            cleaned = cleaned.substring(1);
        }

        // Maksimum 10 karakter (5XX XXX XX XX)
        if (cleaned.length <= 10) {
            setPhone(cleaned);
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;

        // Telefon numarası doğrulaması
        if (phone.length !== 10 || !phone.startsWith('5')) {
            Alert.alert("Hata", "Lütfen geçerli bir telefon numarası giriniz (5XX XXX XX XX).");
            return;
        }

        if (!fullName.trim()) {
            Alert.alert("Hata", "Lütfen adınızı ve soyadınızı giriniz.");
            return;
        }

        setSaving(true);
        try {
            await userService.updateProfile(user.id, {
                fullName,
                phone,
                address
            });
            Alert.alert("Başarılı", "Bilgileriniz başarıyla kaydedildi.");
        } catch (error: any) {
            console.error("Bilgiler güncellenirken hata:", error);
            Alert.alert("Hata", error.message || "Bilgiler güncellenirken bir hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleDowngrade = async () => {
        Alert.alert(
            "Hesabı Bireysel Yap",
            "Kurumsal bilgileriniz silinecek ve hesabınız bireysel hesaba dönüştürülecek. Onaylıyor musunuz?",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Evet, Yap",
                    style: "destructive",
                    onPress: async () => {
                        if (!user?.id) return;
                        setSaving(true);
                        try {
                            await userService.downgradeToIndividual(user.id);
                            Alert.alert("Başarılı", "Hesabınız bireysel hesaba dönüştürüldü.");
                            router.back();
                        } catch (error: any) {
                            console.error("Downgrade hatası:", error);
                            Alert.alert("Hata", "Hesap dönüştürülürken bir hata oluştu.");
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };
    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/home")}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Hesap Bilgilerim</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.roleBadgeContainer}>
                    <View style={styles.roleBadge}>
                        <MaterialIcons
                            name={profile?.is_company || profile?.corporate_info ? 'business' : 'person'}
                            size={20}
                            color={colors.primary}
                        />
                        <Text style={styles.roleText}>
                            {profile?.is_company || profile?.corporate_info ? 'Kurumsal Üye' : 'Bireysel Üye'}
                        </Text>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Ad Soyad</Text>
                    <View style={[styles.inputContainer, styles.readOnlyInput]}>
                        <MaterialIcons name="person" size={20} color={colors.muted} />
                        <TextInput
                            style={[styles.input, { color: colors.muted }]}
                            value={fullName}
                            editable={false}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Telefon Numarası</Text>
                    <View style={[styles.inputContainer, styles.readOnlyInput]}>
                        <MaterialIcons name="phone" size={20} color={colors.muted} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 16, color: colors.muted, fontWeight: 'bold', marginRight: 8 }}>+90</Text>
                            <TextInput
                                style={[styles.input, { color: colors.muted }]}
                                value={phone}
                                editable={false}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Adres</Text>
                    <View style={[styles.inputContainer, { height: 'auto', paddingVertical: 12 }]}>
                        <MaterialIcons name="location-on" size={20} color={colors.primary} style={{ marginTop: 2 }} />
                        <TextInput
                            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Açık adresinizi giriniz"
                            placeholderTextColor={colors.muted}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Kaydet Butonu */}
                <TouchableOpacity 
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
                    onPress={handleSave} 
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.background} />
                    ) : (
                        <Text style={styles.saveBtnText}>BİLGİLERİMİ KAYDET</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.infoBox}>
                    <MaterialIcons name="info-outline" size={20} color={colors.muted} />
                    <Text style={styles.infoText}>
                        Ad ve Telefon bilgileriniz güvenlik için değiştirilemez. adres bilginiz ise siparişlerinizde otomatik kullanılır.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderColor: colors.surfaceBorder
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },

    scrollContent: { padding: 24, paddingBottom: 40, gap: 24 },

    formGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginLeft: 4 },

    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, height: 56
    },
    input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
    readOnlyInput: {
        backgroundColor: colors.background,
        borderColor: colors.surfaceBorder + '80',
    },

    roleBadgeContainer: {
        alignItems: 'center', marginBottom: 8
    },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '40'
    },
    roleText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },

    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: colors.muted,
        lineHeight: 18,
    },

    saveBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: "center", justifyContent: "center",
        marginTop: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    saveBtnText: { color: colors.background, fontSize: 16, fontWeight: "bold" },
    downgradeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 32, padding: 12, borderRadius: 12,
        borderWidth: 1, borderColor: colors.danger + '40',
        backgroundColor: colors.danger + '08'
    },
    downgradeBtnText: { color: colors.danger, fontSize: 14, fontWeight: '600' }
});
