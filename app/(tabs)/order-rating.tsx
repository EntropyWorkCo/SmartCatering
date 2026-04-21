import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrderRatingScreen() {
    const router = useRouter();
    const { orderId } = useLocalSearchParams();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);
    const { user } = useAuth();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [itemRatings, setItemRatings] = useState<{ [key: string]: number }>({});
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [existingRating, setExistingRating] = useState<any>(null);

    useEffect(() => {
        const id = (Array.isArray(orderId) ? orderId[0] : orderId) || "";
        if (!id) {
            Alert.alert("Hata", "Sipariş bulunamadı.", [{ text: "Tamam", onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/home") }]);
            return;
        }

        const safeOrderId: string = id; // Explicit string guarantee

        const fetchOrderDetails = async () => {
            console.log("Değerlendirme Kontrolü Başladı. Sipariş ID:", safeOrderId);
            try {
                // 1. Sipariş detaylarını çek
                const { data: orderData, error: orderErr } = await supabase
                    .from("adisyon")
                    .select("*, adisyon_items(*, menu_items(name))")
                    .eq("id", safeOrderId)
                    .single();

                if (orderErr) throw orderErr;
                setOrder(orderData);

                // 2. Bu sipariş için önceden verilmiş feedback var mı?
                const { data: feedbackData, error: feedbackErr } = await supabase
                    .from("feedbacks")
                    .select("*")
                    .eq("order_id", safeOrderId)
                    .limit(1);

                if (feedbackErr) {
                    console.error("Feedback sorgu hatası:", feedbackErr);
                }

                console.log("Sorgulanan Sipariş için bulanan feedback:", feedbackData);

                if (feedbackData && feedbackData.length > 0) {
                    const fb = feedbackData[0];
                    console.log("Bu sipariş ÖNCEDEN DEĞERLENDİRİLMİŞ.");
                    setHasRated(true);
                    setExistingRating(fb);
                    
                    try {
                        const parsedNote = JSON.parse(fb.note || "{}");
                        setComment(parsedNote.text || "");
                        
                        const restoredRatings: { [key: string]: number } = {};
                        orderData.adisyon_items?.forEach((item: any) => {
                            const detail = (parsedNote.details || []).find((d: any) => d.name === item.menu_items?.name);
                            restoredRatings[item.id] = detail ? detail.rating : 0;
                        });
                        setItemRatings(restoredRatings);
                    } catch (e) {
                         setComment(fb.note || "");
                    }
                } else {
                    console.log("Bu sipariş HENÜZ değerlendirilmemiş.");
                    const initialRatings: { [key: string]: number } = {};
                    orderData.adisyon_items?.forEach((item: any) => {
                        initialRatings[item.id] = 0;
                    });
                    setItemRatings(initialRatings);
                }
            } catch (error) {
                console.error("Detay getirme hatası:", error);
                Alert.alert("Hata", "Sipariş detayları yüklenemedi.");
            } finally {
                setLoading(false);
            }
        };

        fetchOrderDetails();
    }, [orderId]);

    const submitRating = async () => {
        const hasRating = Object.values(itemRatings).some(r => r > 0);
        if (!hasRating && !comment.trim()) {
            Alert.alert("Hata", "Lütfen en az bir yıldıza basarak puan verin veya yorum yazın.");
            return;
        }

        setSubmitting(true);
        try {
            const ratedItems = Object.values(itemRatings).filter(r => r > 0);
            const generalRating = ratedItems.length > 0
                ? Math.round(ratedItems.reduce((a, b) => a + b, 0) / ratedItems.length)
                : 0;

            const structuredDetails = (order.adisyon_items || [])
                .filter((item: any) => (itemRatings[item.id] || 0) > 0)
                .map((item: any) => ({
                    name: item.menu_items?.name || 'Ürün',
                    rating: itemRatings[item.id]
                }));

            const safeId: string = (Array.isArray(orderId) ? orderId[0] : orderId) || "";
            if (!safeId) throw new Error("Sipariş ID bulunamadı.");
            
            // Bypass missing rating_details column by combining data into the note field
            const combinedNote = JSON.stringify({
                text: comment.trim(),
                details: structuredDetails.length > 0 ? structuredDetails : null
            });

            await supabase.from("feedbacks").insert({
                user_id: user?.id || "",
                order_id: safeId,
                rating: generalRating,
                note: combinedNote
            });

            Alert.alert("Başarılı", "Değerlendirmeniz kaydedildi. Geri bildiriminiz için teşekkür ederiz!", [
                { text: "Tamam", onPress: () => router.replace("/(tabs)/past-orders") }
            ]);
        } catch (error: any) {
            Alert.alert("Hata", error.message || "Değerlendirme gönderilemedi.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!order) return null;

    const date = new Date(order.created_at || order.date);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/(tabs)/past-orders");
                        }
                    }}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Değerlendir</Text>
                    </View>
                    <ThemeSwitcher />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.orderSummaryCard}>
                        <View style={styles.orderHeader}>
                            <View style={styles.orderTitleBox}>
                                <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
                                <Text style={styles.orderNumber}>
                                    Sipariş #{order.order_number || String(order.id).substring(0, 6).toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.orderDate}>
                                {date.toLocaleDateString('tr-TR')} {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                            </Text>
                        </View>
                        <Text style={styles.summaryHelpText}>
                            {hasRated ? "Bu siparişi daha önce değerlendirdiniz." : "Lütfen yediğiniz ürünleri puanlayın."}
                        </Text>
                    </View>

                    <View style={styles.ratingSection}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Menü İçeriği</Text>
                            {hasRated && (
                                <View style={{ backgroundColor: '#10b98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '900' }}>DEĞERLENDİRİLDİ</Text>
                                </View>
                            )}
                        </View>
                        
                        {order.adisyon_items?.map((item: any) => (
                            <View key={item.id} style={styles.ratingRow}>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemQty}>{item.quantity}x</Text>
                                    <Text style={styles.itemName} numberOfLines={2}>{item.menu_items?.name || 'Ürün'}</Text>
                                </View>
                                <View style={styles.starsBox}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity
                                            key={star}
                                            onPress={() => !hasRated && setItemRatings(prev => ({ ...prev, [item.id]: star }))}
                                            style={styles.starBtn}
                                            disabled={hasRated}
                                        >
                                            <MaterialIcons
                                                name={itemRatings[item.id] >= star ? "star" : "star-border"}
                                                size={32}
                                                color={itemRatings[item.id] >= star ? "#fbbf24" : colors.surfaceBorder}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.commentSection}>
                        <Text style={styles.sectionTitle}>Mesajınız (İsteğe Bağlı)</Text>
                        <TextInput
                            style={[styles.commentInput, hasRated && { opacity: 0.8, backgroundColor: colors.background }]}
                            placeholder="Siparişle ilgili eklemek istedikleriniz..."
                            placeholderTextColor={colors.muted}
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            editable={!hasRated}
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.submitBtn, 
                            (submitting || hasRated || (!Object.values(itemRatings).some(r => r > 0) && !comment.trim())) && { opacity: 0.5, backgroundColor: hasRated ? '#10b981' : colors.primary }
                        ]}
                        onPress={submitRating}
                        disabled={submitting || hasRated || (!Object.values(itemRatings).some(r => r > 0) && !comment.trim())}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <MaterialIcons name={hasRated ? "check-circle" : "send"} size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>{hasRated ? "Değerlendirildi" : "Değerlendirmeyi Gönder"}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
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
    scrollContent: { padding: 24, paddingBottom: 60, flexGrow: 1 },

    orderSummaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginBottom: 24,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
    },
    orderDate: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.muted,
    },
    summaryHelpText: {
        fontSize: 13,
        color: colors.muted,
        marginTop: 4,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 16,
    },
    ratingSection: {
        marginBottom: 32,
    },
    ratingRow: {
        flexDirection: 'column',
        marginBottom: 20,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    itemQty: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
        backgroundColor: `${colors.primary}15`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },
    starsBox: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        backgroundColor: colors.background,
        borderRadius: 12,
    },
    starBtn: {
        padding: 4,
    },

    commentSection: {
        marginBottom: 32,
    },
    commentInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: colors.text,
        minHeight: 120,
    },

    submitBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 16,
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
