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

    const [oldCode, setOldCode] = useState("");
    const [newCode, setNewCode] = useState("");
    const [confirmCode, setConfirmCode] = useState("");

    const handleSave = () => {
        // Current code from your auth logic/storage: Mock 1234
        const currentCode = "1234";

        if (oldCode !== currentCode) {
            Alert.alert("Hata", "Mevcut kod hatalı!");
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

        Alert.alert("Başarılı", "Erişim kodu başarıyla değiştirildi.");
        router.back();
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.title}>Giriş Kodu Değiştir</Text>
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
                    <MaterialIcons name="lock-reset" size={24} color="#fff" />
                    <Text style={styles.saveBtnText}>Kodu Güncelle</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
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
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginRight: 16,
    },
    title: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
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
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 12,
        marginLeft: 4,
    },
    input: {
        backgroundColor: "#fff",
        borderRadius: 24,
        paddingVertical: 20,
        paddingHorizontal: 24,
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 10,
        color: "#0f172a",
        textAlign: "center",
        borderWidth: 1,
        borderColor: "#f1f5f9",
    },
    divider: {
        height: 1,
        backgroundColor: "#e2e8f0",
        marginVertical: 8,
        marginBottom: 32,
    },
    saveBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#74CF62",
        paddingVertical: 24,
        borderRadius: 24,
        shadowColor: "#74CF62",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    saveBtnText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
    },
});
