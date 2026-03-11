import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function RatingScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { orderId } = useLocalSearchParams<{ orderId?: string }>();
    const { user } = useAuth();

    const [order, setOrder] = useState<any>(null);
    const [loadingOrder, setLoadingOrder] = useState(!!orderId);
    const [rating, setRating] = useState(0);
    const [itemRatings, setItemRatings] = useState<{ [key: string]: number }>({});
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrderDetails(orderId);
        }
    }, [orderId]);

    const fetchOrderDetails = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from("adisyon")
                .select("*, adisyon_items(*, menu_items(name))")
                .eq("id", id)
                .single();

            if (data) {
                setOrder(data);
                // Initialize item ratings
                const initial: { [key: string]: number } = {};
                data.adisyon_items?.forEach((item: any) => {
                    initial[item.id] = 0;
                });
                setItemRatings(initial);
            }
        } catch (err) {
            console.error("Order fetch error:", err);
        } finally {
            setLoadingOrder(false);
        }
    };

    const updateItemRating = (itemId: string, val: number) => {
        setItemRatings(prev => ({ ...prev, [itemId]: val }));
    };

    // Example list of predefined tags
    const tags = ["Lezzetli", "Hızlı Teslimat", "Sıcak Geldi", "Porsiyon Doyurucu", "Kötü Paketlenmiş", "Geç Geldi", "Soğuktu"];
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert("Eksik Puan", "Lütfen bir yıldız puanı seçiniz.");
            return;
        }

        setSubmitting(true);
        try {
            if (user) {
                const finalNote = [
                    selectedTags.length > 0 ? selectedTags.join(", ") : "",
                    comment
                ].filter(Boolean).join(" - ");

                await supabase.from("feedbacks").insert({
                    user_id: user.id,
                    order_id: orderId || null,
                    rating,
                    note: finalNote,
                    // Store detailed ratings as JSON in a new column or format the note
                    // For now, let's format them into the note since we don't want to break schema
                    // unless we add specific columns. Actually let's just use the note for now.
                    rating_details: itemRatings 
                });
            }

            Alert.alert("Teşekkürler!", "Değerlendirmeniz başarıyla alındı.", [
                { text: "Tamam", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert("Hata", error.message || "Değerlendirme gönderilemedi.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Değerlendir</Text>
                    </View>
                    <ThemeSwitcher />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.topSection}>
                        <Text style={styles.questionText}>Siparişinden genel olarak memnun kaldın mı?</Text>
                        <Text style={styles.subQuestionText}>Puan vererek bize gelişmemiz için yardımcı ol.</Text>

                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7} style={styles.starBtn}>
                                    <MaterialIcons
                                        name={rating >= star ? "star" : "star-border"}
                                        size={40}
                                        color={rating >= star ? "#fbbf24" : colors.surfaceBorder}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {order && order.adisyon_items && order.adisyon_items.length > 0 && (
                        <View style={styles.categoriesSection}>
                            <Text style={styles.categoryTitle}>Yemekleri Puanla</Text>
                            {order.adisyon_items.map((item: any) => (
                                <RatingRow 
                                    key={item.id}
                                    label={item.menu_items?.name || 'Ürün'} 
                                    value={itemRatings[item.id] || 0} 
                                    onSelect={(val: number) => updateItemRating(item.id, val)} 
                                    colors={colors} 
                                    styles={styles} 
                                />
                            ))}
                        </View>
                    )}

                    {!orderId && (
                        <View style={styles.categoriesSection}>
                            <Text style={styles.categoryTitle}>Genel Kategori Puanlama</Text>
                            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
                                Belirli bir siparişi değerlendirmek için "Geçmiş Siparişlerim" ekranını kullanabilirsiniz.
                            </Text>
                            <View style={styles.emptyItemsBox}>
                                <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                                <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
                                    Genel değerlendirme için aşağıdaki yıldızları ve yorum alanını kullanın.
                                </Text>
                            </View>
                        </View>
                    )}

                    {rating > 0 && (
                        <View style={styles.feedbackSection}>
                            <Text style={styles.sectionTitle}>Neyi daha iyi yapabilirdik veya neleri sevdiniz?</Text>

                            <View style={styles.tagsContainer}>
                                {tags.map(tag => {
                                    const isActive = selectedTags.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={tag}
                                            style={[styles.tag, isActive && styles.tagActive]}
                                            onPress={() => toggleTag(tag)}
                                        >
                                            <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{tag}</Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>

                            <Text style={styles.sectionTitle}>Eklemek istedikleriniz (Opsiyonel)</Text>
                            <View style={styles.textAreaContainer}>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Deneyiminizi kısaca paylaşın..."
                                    placeholderTextColor={colors.muted}
                                    value={comment}
                                    onChangeText={setComment}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>
                    )}

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={rating === 0 || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitBtnText}>Değerlendirmeyi Gönder</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function RatingRow({ label, value, onSelect, colors, styles }: any) {
    return (
        <View style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>{label}</Text>
            <View style={styles.categoryStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => onSelect(star)} activeOpacity={0.7}>
                        <MaterialIcons
                            name={value >= star ? "star" : "star-border"}
                            size={24}
                            color={value >= star ? "#fbbf24" : colors.surfaceBorder}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
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

    scrollContent: { paddingBottom: 40 },

    topSection: { padding: 32, alignItems: 'center', borderBottomWidth: 1, borderColor: colors.surfaceBorder },
    questionText: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 8 },
    subQuestionText: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 32 },

    starsContainer: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
    starBtn: { padding: 4 },

    categoriesSection: { padding: 24, borderBottomWidth: 1, borderColor: colors.surfaceBorder },
    categoryTitle: { fontSize: 13, fontWeight: 'bold', color: colors.muted, marginBottom: 16, textTransform: 'uppercase' },
    categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    categoryLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    categoryStars: { flexDirection: 'row', gap: 4 },

    feedbackSection: { padding: 24, gap: 16 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8, marginTop: 8 },

    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    tag: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder
    },
    tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tagText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    tagTextActive: { color: '#fff' },

    textAreaContainer: {
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        padding: 16, minHeight: 120
    },
    textArea: { flex: 1, fontSize: 15, color: colors.text },
    emptyItemsBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.primary + '10',
        padding: 12,
        borderRadius: 12,
        marginTop: 8
    },
    footer: { padding: 24, paddingBottom: 32, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.surfaceBorder },
    submitBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    submitBtnDisabled: { backgroundColor: colors.surfaceBorder, shadowOpacity: 0, elevation: 0 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
