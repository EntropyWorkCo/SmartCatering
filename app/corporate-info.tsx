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

export default function CorporateInfoScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile, loading } = useProfile(user?.id);

    const [companyName, setCompanyName] = useState("");
    const [taxNumber, setTaxNumber] = useState("");
    const [companyPhone, setCompanyPhone] = useState("");
    const [invoiceAddress, setInvoiceAddress] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.corporate_info) {
            setCompanyName(profile.corporate_info.companyName || "");
            setTaxNumber(profile.corporate_info.taxNumber || "");
            setCompanyPhone(profile.corporate_info.companyPhone || "");
            setInvoiceAddress(profile.corporate_info.invoiceAddress || "");
        }
    }, [profile]);

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            await userService.updateCorporateInfo(user.id, {
                companyName,
                taxNumber,
                companyPhone,
                invoiceAddress
            });
            Alert.alert("Başarılı", "Kurumsal fatura bilgileriniz güncellendi.");
        } catch (error: any) {
            console.error("Firma bilgileri kaydedilirken hata:", error);
            Alert.alert("Hata", error.message || "Bilgiler kaydedilirken bir hata oluştu.");
        } finally {
            setSaving(false);
        }
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
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Kurumsal Bilgiler</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.infoBanner}>
                    <MaterialIcons name="receipt-long" size={24} color={colors.primary} />
                    <Text style={styles.infoText}>Fatura kesilebilmesi için kurumsal bilgilerinizi eksiksiz doldurunuz.</Text>
                </View>

                <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, marginBottom: 20 }]}>
                    <MaterialIcons name="info-outline" size={20} color={colors.muted} />
                    <Text style={[styles.infoText, { color: colors.muted }]}>
                        Firma adı ve VKN bilgileri güvenlik için kilitlidir. Değişiklik için yöneticiye başvurun.
                    </Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Firma / Şirket Adı</Text>
                    <View style={[styles.inputContainer, styles.readOnlyInput]}>
                        <MaterialIcons name="business" size={20} color={colors.muted} />
                        <TextInput
                            style={[styles.input, { color: colors.muted }]}
                            value={companyName}
                            editable={false}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Vergi Numarası / TCKN</Text>
                    <View style={[styles.inputContainer, styles.readOnlyInput]}>
                        <MaterialIcons name="tag" size={20} color={colors.muted} />
                        <TextInput
                            style={[styles.input, { color: colors.muted }]}
                            value={taxNumber}
                            editable={false}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Firma Telefon Numarası</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="phone" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Firma Telefonu"
                            placeholderTextColor={colors.muted}
                            value={companyPhone}
                            onChangeText={setCompanyPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Fatura Adresi</Text>
                    <View style={[styles.inputContainer, styles.textAreaContainer]}>
                        <MaterialIcons name="location-on" size={20} color={colors.muted} style={{ marginTop: 14 }} />
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Açık Fatura Adresi"
                            placeholderTextColor={colors.muted}
                            value={invoiceAddress}
                            onChangeText={setInvoiceAddress}
                            multiline
                            textAlignVertical="top"
                            numberOfLines={4}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Bilgileri Kaydet</Text>
                    )}
                </TouchableOpacity>
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

    scrollContent: { padding: 24, paddingBottom: 40, gap: 20 },

    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.infoBg,
        padding: 16, borderRadius: 16,
        borderWidth: 1, borderColor: colors.infoBorder,
        marginBottom: 8
    },
    infoText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18, fontWeight: '500' },

    formGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginLeft: 4 },

    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, minHeight: 56
    },
    textAreaContainer: { alignItems: 'flex-start', paddingVertical: 4 },
    input: { flex: 1, fontSize: 15, color: colors.text, height: '100%' },
    readOnlyInput: {
        backgroundColor: colors.background,
        borderColor: colors.surfaceBorder + '80',
    },
    textArea: { minHeight: 90, paddingTop: 12, paddingBottom: 12 },

    saveBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    saveBtnText: { color: colors.background, fontSize: 16, fontWeight: 'bold' }
});
