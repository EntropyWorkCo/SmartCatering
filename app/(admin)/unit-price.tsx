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
    const [prices, setPrices] = useState({
        CORBA: "135",
        ANAYEMEK: "180",
        YARDIMCI: "90",
        ICECEKLER: "40",
    });

    // Load initial unit prices from AsyncStorage
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
            // Save to local storage for quick access
            await AsyncStorage.setItem("unit_prices", JSON.stringify(prices));

            // Sabit fiyatlar AsyncStorage'a kaydedilir
            await AsyncStorage.setItem("unit_prices", JSON.stringify(prices));

            Alert.alert(
                "Fiyatları Güncelle",
                "Bu fiyatları sadece Kategori varsayılanı olarak mı kaydedelim, yoksa Sistemdeki TÜM mevcut ürünlerin fiyatlarını da bu kategorilere göre ezelim mi?",
                [
                    {
                        text: "Sadece Varsayılanları Güncelle",
                        onPress: () => {
                            Alert.alert("Başarılı", "Yeni kategori taban fiyatları güncellendi.");
                            router.replace("/(admin)/menu");
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
                                        await supabase
                                            .from("menu_items")
                                            .update({ price: update.price })
                                            .eq("category", update.category);
                                    }
                                }
                                Alert.alert("Başarılı", "Tüm eski ürünlerin fiyatları da güncellendi.");
                                router.replace("/(admin)/menu");
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
            style={{ flex: 1, backgroundColor: "#f8fafc" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => router.replace("/(admin)/menu")} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>Birim Fiyatlar</Text>
                    <Text style={styles.subtitle}>KATEGORİ TABANLI FİYAT GÜNCELLEME</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <MaterialIcons name="info" size={24} color="#3b82f6" style={{ marginTop: 2 }} />
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
                    />
                    <InputField
                        label="ANA YEMEK"
                        icon="restaurant"
                        value={prices.ANAYEMEK}
                        onChangeText={(text) => setPrices({ ...prices, ANAYEMEK: text })}
                    />
                    <InputField
                        label="YARDIMCI"
                        icon="flatware"
                        value={prices.YARDIMCI}
                        onChangeText={(text) => setPrices({ ...prices, YARDIMCI: text })}
                    />
                    <InputField
                        label="İÇECEKLER (Ayran, Gazoz vs.)"
                        icon="local-drink"
                        value={prices.ICECEKLER}
                        onChangeText={(text) => setPrices({ ...prices, ICECEKLER: text })}
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <MaterialIcons name="save" size={20} color="#fff" />
                                <Text style={styles.saveBtnText}>TÜMÜNÜ GÜNCELLE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const InputField = ({ label, icon, value, onChangeText }: { label: string, icon: any, value: string, onChangeText: (t: string) => void }) => (
    <View style={styles.inputWrapper}>
        <View style={styles.inputIconRow}>
            <MaterialIcons name={icon} size={18} color="#64748b" />
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
                placeholderTextColor="#94a3b8"
                maxLength={4}
            />
        </View>
    </View>
);

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    backButton: {
        padding: 8,
        marginRight: 12,
        backgroundColor: "#f1f5f9",
        borderRadius: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1e293b",
    },
    subtitle: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 2,
        fontWeight: "600",
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    infoText: {
        color: '#1e40af',
        fontSize: 14,
        lineHeight: 20
    },
    formContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
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
        fontWeight: "600",
        color: "#475569",
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: "#1e293b",
    },
    saveBtn: {
        backgroundColor: "#74CF62",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 12,
    },
    saveBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});
