import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UnitPriceFormScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [prices, setPrices] = useState({
        CORBA: "135",
        ANAYEMEK: "180",
        YARDIMCI: "90",
        ICECEKLER: "40",
    });

    useFocusEffect(
        useCallback(() => {
            const loadPrices = async () => {
                try {
                    const stored = await AsyncStorage.getItem("unit_prices");
                    if (stored) {
                        setPrices(JSON.parse(stored));
                    }
                } catch (e) {
                    console.error("Fiyatlar yüklenirken hata:", e);
                }
            };
            loadPrices();
        }, [])
    );

    const handleSave = async () => {
        setLoading(true);
        try {
            await AsyncStorage.setItem("unit_prices", JSON.stringify(prices));

            Alert.alert(
                "Fiyatları Güncelle",
                "Bu fiyatları sadece Kategori varsayılanı olarak mı kaydedelim, yoksa Sistemdeki TÜM mevcut ürünlerin fiyatlarını da bu kategorilere göre ezelim mi?",
                [
                    {
                        text: "Sadece Varsayılanları Güncelle",
                        onPress: () => {
                            Alert.alert("Başarılı", "Yeni kategori taban fiyatları güncellendi.");
                            router.back();
                        }
                    },
                    {
                        text: "Tüm Eski Ürünleri De Güncelle (Ez)",
                        style: "destructive",
                        onPress: async () => {
                            setLoading(true);
                            try {
                                const updates = [
                                    { category: "ÇORBA", price: Number(prices.CORBA) },
                                    { category: "ANA YEMEK", price: Number(prices.ANAYEMEK) },
                                    { category: "YARDIMCI", price: Number(prices.YARDIMCI) },
                                    { category: "İÇECEK", price: Number(prices.ICECEKLER) },
                                ];

                                for (const update of updates) {
                                    if (!isNaN(update.price) && update.price > 0) {
                                        const { error } = await supabase
                                            .from("menu_items")
                                            .update({ price: update.price })
                                            .eq("category", update.category)
                                            .select();
                                        if (error) throw error;
                                    }
                                }
                                Alert.alert("Başarılı", "Tüm eski ürünlerin fiyatları da güncellendi.");
                                router.back();
                            } catch (e: any) {
                                Alert.alert("Hata", e.message);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );

        } catch (error: any) {
            Alert.alert("Hata", "Kaydedilirken bir sorun oluştu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Birim Fiyatlar</Text>
                    <Text style={styles.subtitle}>KATEGORİ TABANLI FİYATGÜNCELLEME</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <MaterialIcons name="info" size={24} color={colors.info} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoText}>
                            Burada yaptığınız değişiklikler, <Text style={{ fontWeight: 'bold' }}>Sabit Listedeki</Text> o kategoriye ait tüm ürünlerin fiyatlarını otomatik olarak güncelleyecektir.
                        </Text>
                    </View>
                </View>

                <View style={styles.formContainer}>
                    <InputField
                        label="ÇORBA ÇEŞİTLERİ"
                        icon="soup-kitchen"
                        value={prices.CORBA}
                        onChangeText={(text) => setPrices({ ...prices, CORBA: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="ANA YEMEK"
                        icon="restaurant"
                        value={prices.ANAYEMEK}
                        onChangeText={(text) => setPrices({ ...prices, ANAYEMEK: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="YARDIMCI"
                        icon="flatware"
                        value={prices.YARDIMCI}
                        onChangeText={(text) => setPrices({ ...prices, YARDIMCI: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="İÇECEKLER (Ayran, Gazoz vs.)"
                        icon="local-drink"
                        value={prices.ICECEKLER}
                        onChangeText={(text) => setPrices({ ...prices, ICECEKLER: text })}
                        colors={colors}
                        styles={styles}
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <>
                                <MaterialIcons name="save" size={20} color={colors.background} />
                                <Text style={styles.saveBtnText}>TÜMÜNÜ GÜNCELLE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const InputField = ({ label, icon, value, onChangeText, colors, styles }: any) => (
    <View style={styles.inputWrapper}>
        <View style={styles.inputIconRow}>
            <MaterialIcons name={icon} size={18} color={colors.muted} />
            <Text style={styles.inputLabel}>{label}</Text>
        </View>
        <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>₺</Text>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
                maxLength={4}
            />
        </View>
    </View>
);

const getStyles = (colors: any) => StyleSheet.create({
    keyboardContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
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
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: colors.text,
    },
    subtitle: {
        fontSize: 10,
        color: colors.muted,
        marginTop: 2,
        fontWeight: "900",
        letterSpacing: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.infoBg,
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.info
    },
    infoText: {
        color: colors.info,
        fontSize: 14,
        lineHeight: 20
    },
    formContainer: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginBottom: 32,
    },
    inputWrapper: {
        marginBottom: 20,
    },
    inputIconRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 6,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: "900",
        color: colors.muted,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 12,
    },
    saveBtnText: {
        color: colors.background,
        fontSize: 14,
        fontWeight: "bold",
    },
});
