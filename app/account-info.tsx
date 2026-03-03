import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function AccountInfoScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile, loading } = useProfile(user?.id);

    const [phone, setPhone] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [gender, setGender] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setPhone(profile.phone || "");
            setBirthDate(profile.birth_date || "");
            setGender(profile.gender || "");
        }
    }, [profile]);

    const handleSave = () => {
        setSaving(true);
        // Simulating save operation
        setTimeout(() => {
            setSaving(false);
            Alert.alert("Başarılı", "Bilgileriniz kaydedildi.");
        }, 1000);
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
                <Text style={styles.title}>Hesap Bilgilerim</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Telefon Numarası</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="phone" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            placeholder="0 (5XX) XXX XX XX"
                            placeholderTextColor={colors.muted}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Doğum Tarihi</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            placeholder="GG.AA.YYYY"
                            placeholderTextColor={colors.muted}
                            value={birthDate}
                            onChangeText={setBirthDate}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Cinsiyet</Text>
                    <View style={styles.genderRow}>
                        <TouchableOpacity
                            style={[styles.genderBtn, gender === "Erkek" && styles.genderBtnActive]}
                            onPress={() => setGender("Erkek")}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="male" size={24} color={gender === "Erkek" ? "#fff" : colors.muted} />
                            <Text style={[styles.genderBtnText, gender === "Erkek" && { color: "#fff" }]}>Erkek</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.genderBtn, gender === "Kadın" && styles.genderBtnActive]}
                            onPress={() => setGender("Kadın")}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="female" size={24} color={gender === "Kadın" ? "#fff" : colors.muted} />
                            <Text style={[styles.genderBtnText, gender === "Kadın" && { color: "#fff" }]}>Kadın</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.genderBtn, gender === "Belirtmek İstemiyorum" && styles.genderBtnActive]}
                            onPress={() => setGender("Belirtmek İstemiyorum")}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.genderBtnText, gender === "Belirtmek İstemiyorum" && { color: "#fff" }]}>Diğer</Text>
                        </TouchableOpacity>
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
                        <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
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

    genderRow: { flexDirection: 'row', gap: 12 },
    genderBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: colors.surface, borderRadius: 16, height: 56,
        borderWidth: 1, borderColor: colors.surfaceBorder
    },
    genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    genderBtnText: { fontSize: 14, fontWeight: 'bold', color: colors.muted },

    saveBtn: {
        backgroundColor: colors.text,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    saveBtnText: { color: colors.background, fontSize: 16, fontWeight: 'bold' }
});
