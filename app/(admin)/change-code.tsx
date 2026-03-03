import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminChangeCode() {
    const insets = useSafeAreaInsets();

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [oldCode, setOldCode] = useState("");
    const [newCode, setNewCode] = useState("");
    const [confirmCode, setConfirmCode] = useState("");

    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!oldCode || !newCode || !confirmCode) {
            Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
            return;
        }
        if (newCode !== confirmCode) {
            Alert.alert("Hata", "Yeni kodlar eşleşmiyor!");
            return;
        }
        if (newCode.length < 4) {
            Alert.alert("Hata", "Kod en az 4 haneli olmalıdır.");
            return;
        }

        setLoading(true);
        try {
            // 1. Kullanıcının mevcut e-postasını al
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) throw new Error("Kullanıcı oturumu bulunamadı.");

            // 2. Mevcut parolası (kodu) doğru mu diye teyit et
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: oldCode,
            });

            if (signInError) {
                setLoading(false);
                Alert.alert("Hata", "Mevcut kodunuz (parola) hatalı!");
                return;
            }

            // 3. Doğrulandıysa yeni parolayı (kodu) belirle
            const { error: updateError } = await supabase.auth.updateUser({
                password: newCode
            });

            if (updateError) throw updateError;

            Alert.alert("Başarılı", "Erişim kodu (Parola) başarıyla değiştirildi.");
            router.back();
        } catch (err: any) {
            Alert.alert("Hata", "Kod güncellenirken bir hata oluştu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Kodu Değiştir</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>MEVCUT ERİŞİM KODU</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={oldCode}
                            onChangeText={setOldCode}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>YENİ ERİŞİM KODU</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={newCode}
                            onChangeText={setNewCode}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>YENİ KODU ONAYLA</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={confirmCode}
                            onChangeText={setConfirmCode}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                    <MaterialIcons name="lock-reset" size={24} color={colors.background} />
                    <Text style={styles.saveBtnText}>Kodu Güncelle</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 24,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginRight: 16,
    },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    formContainer: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 12,
        marginLeft: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        paddingVertical: 20,
        paddingHorizontal: 24,
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 10,
        color: colors.text,
        textAlign: "center",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    divider: {
        height: 1,
        backgroundColor: colors.surfaceBorder,
        marginVertical: 8,
        marginBottom: 32,
    },
    saveBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: colors.primary,
        paddingVertical: 24,
        borderRadius: 24,
    },
    saveBtnText: {
        color: colors.background,
        fontSize: 14,
        fontWeight: "900",
    },
});
