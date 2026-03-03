import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function OrderSelectionScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [selectedType, setSelectedType] = useState<"Şimdi Ye" | "Sonra Ye (Gel-Al)" | null>(null);

    const handleContinue = () => {
        if (selectedType) {
            // Typically we might store this in CartStore or pass as parameter
            // For now, redirect to menu as in original flow
            router.push("/(tabs)/menu");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Nasıl Almak İstersin?</Text>
            </View>

            <View style={styles.content}>
                <TouchableOpacity
                    style={[styles.optionCard, selectedType === "Şimdi Ye" && styles.optionCardActive]}
                    onPress={() => setSelectedType("Şimdi Ye")}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBox, { backgroundColor: selectedType === "Şimdi Ye" ? colors.primary : colors.surfaceBorder }]}>
                        <MaterialIcons name="restaurant" size={32} color={selectedType === "Şimdi Ye" ? "#fff" : colors.muted} />
                    </View>
                    <View style={styles.optionTexts}>
                        <Text style={styles.optionTitle}>Şimdi Ye</Text>
                        <Text style={styles.optionDesc}>Siparişini hemen restoranımızda ye.</Text>
                    </View>
                    {selectedType === "Şimdi Ye" && <MaterialIcons name="check-circle" size={24} color={colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.optionCard, selectedType === "Sonra Ye (Gel-Al)" && styles.optionCardActive]}
                    onPress={() => setSelectedType("Sonra Ye (Gel-Al)")}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBox, { backgroundColor: selectedType === "Sonra Ye (Gel-Al)" ? colors.primary : colors.surfaceBorder }]}>
                        <MaterialIcons name="shopping-bag" size={32} color={selectedType === "Sonra Ye (Gel-Al)" ? "#fff" : colors.muted} />
                    </View>
                    <View style={styles.optionTexts}>
                        <Text style={styles.optionTitle}>Gel-Al</Text>
                        <Text style={styles.optionDesc}>Siparişini hazırla, gelip teslim al.</Text>
                    </View>
                    {selectedType === "Sonra Ye (Gel-Al)" && <MaterialIcons name="check-circle" size={24} color={colors.primary} />}
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.continueBtn, !selectedType && styles.continueBtnDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedType}
                >
                    <Text style={styles.continueBtnText}>Devam Et</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },

    content: { flex: 1, paddingHorizontal: 24, gap: 16 },

    optionCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: colors.surface, padding: 20, borderRadius: 24,
        borderWidth: 2, borderColor: colors.surfaceBorder,
    },
    optionCardActive: {
        borderColor: colors.primary,
        backgroundColor: colors.cardHighlight
    },
    iconBox: {
        width: 64, height: 64, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center'
    },
    optionTexts: { flex: 1 },
    optionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    optionDesc: { fontSize: 13, color: colors.muted },

    footer: { padding: 24, paddingBottom: 32 },
    continueBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center'
    },
    continueBtnDisabled: {
        backgroundColor: colors.surfaceBorder
    },
    continueBtnText: {
        color: '#fff', fontSize: 16, fontWeight: 'bold'
    }
});
