import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
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
                    setLoading(true);
                    const { data, error } = await supabase
                        .from("menu_items")
                        .select("*")
                        .eq("status", "sistem_fiyati");

                    if (error) throw error;

                    if (data && data.length > 0) {
                        const newPrices = { ...prices };
                        data.forEach((item: any) => {
                            if (item.category === "ÇORBA ÇEŞİTLERİ") newPrices.CORBA = item.price.toString();
                            if (item.category === "ANA YEMEK") newPrices.ANAYEMEK = item.price.toString();
                            if (item.category === "YARDIMCI") newPrices.YARDIMCI = item.price.toString();
                            if (item.category === "İÇECEKLER") newPrices.ICECEKLER = item.price.toString();
                        });
                        setPrices(newPrices);
                    }
                } catch (e) {
                    console.error("Fiyatlar yüklenirken hata:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadPrices();
        }, [])
    );

    const handleSave = async () => {
        setLoading(true);
        try {
            // Update default category prices in Supabase
            const categories = [
                { category: "ÇORBA ÇEŞİTLERİ", price: Number(prices.CORBA) },
                { category: "ANA YEMEK", price: Number(prices.ANAYEMEK) },
                { category: "YARDIMCI", price: Number(prices.YARDIMCI) },
                { category: "İÇECEKLER", price: Number(prices.ICECEKLER) },
            ];

            for (const item of categories) {
                if (!isNaN(item.price) && item.price > 0) {
                    await supabase
                        .from("menu_items")
                        .update({ price: item.price })
                        .eq("status", "sistem_fiyati")
                        .eq("category", item.category);
                }
            }

            Alert.alert(
                "Fiyatları Güncelle",
                "Sabit liste (Tabela) fiyatları başarıyla güncellendi. Sistemdeki TÜM mevcut ürünlerin fiyatlarını da bu yeni fiyatlara göre ezmek ister misiniz?",
                [
                    {
                        text: "Hayır, Sadece Tabelayı Güncelle",
                        onPress: () => {
                            if (router.canGoBack()) router.back();
                            else router.replace("/(admin)/dashboard");
                        }
                    },
                    {
                        text: "Evet, Eski Ürünleri De Güncelle",
                        style: "destructive",
                        onPress: async () => {
                            setLoading(true);
                            try {
                                for (const update of categories) {
                                    if (!isNaN(update.price) && update.price > 0) {
                                        const { error } = await supabase
                                            .from("menu_items")
                                            .update({ price: update.price })
                                            .neq("status", "sistem_fiyati")
                                            .eq("category", update.category);
                                        if (error) throw error;
                                    }
                                }
                                Alert.alert("Başarılı", "Tüm mevcut ürünlerin fiyatları güncellendi.");
                                if (router.canGoBack()) router.back();
                                else router.replace("/(admin)/dashboard");
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
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Birim Fiyatlar</Text>
                    <Text style={styles.subtitle}>KATEGORİ TABANLI FİYATGÜNCELLEME</Text>
                </View>
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
                        onChangeText={(text: string) => setPrices({ ...prices, CORBA: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="ANA YEMEK"
                        icon="restaurant"
                        value={prices.ANAYEMEK}
                        onChangeText={(text: string) => setPrices({ ...prices, ANAYEMEK: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="YARDIMCI"
                        icon="flatware"
                        value={prices.YARDIMCI}
                        onChangeText={(text: string) => setPrices({ ...prices, YARDIMCI: text })}
                        colors={colors}
                        styles={styles}
                    />
                    <InputField
                        label="İÇECEKLER (Ayran, Gazoz vs.)"
                        icon="local-drink"
                        value={prices.ICECEKLER}
                        onChangeText={(text: string) => setPrices({ ...prices, ICECEKLER: text })}
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
        backgroundColor: colors.surfaceBorder,
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    infoText: {
        color: colors.text,
        fontSize: 12,
    },
    formContainer: {
        backgroundColor: colors.surface,
        borderRadius: 12,
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
        fontSize: 12,
        fontWeight: "bold",
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
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.muted,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
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
