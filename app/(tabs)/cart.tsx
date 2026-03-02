import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useCartStore } from "@/lib/store/cartStore";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/hooks/useAuth";
import { adisyonService } from "../../lib/services/adisyonService";

export default function CartScreen() {
    const { items, removeItem, clearCart, getTotal } = useCartStore();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { user } = useAuth();

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [orderType, setOrderType] = useState<"Şimdi Ye" | "Sonra Ye (Gel-Al)">("Şimdi Ye");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCheckout = async () => {
        if (!user) {
            Alert.alert("Hata", "Sipariş verebilmek için giriş yapmalısınız.");
            return;
        }

        if (items.length === 0) {
            Alert.alert("Sepet Boş", "Lütfen önce menüden ürün ekleyin.");
            return;
        }

        Alert.alert(
            "Siparişi Onayla",
            `${getTotal()}₺ tutarındaki siparişinizi onaylıyor musunuz?\nSipariş Türü: ${orderType}`,
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Onayla",
                    style: "default",
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const note = `Sipariş Türü: ${orderType}`;
                            await adisyonService.createOrder(
                                user.id,
                                getTotal(),
                                items,
                                orderType,
                                note
                            );

                            clearCart();
                            Alert.alert("Başarılı", "Siparişiniz başarıyla alındı!", [
                                { text: "Tamam", onPress: () => router.push("/(tabs)/home") }
                            ]);
                        } catch (error: any) {
                            Alert.alert("Hata", "Sipariş oluşturulamadı: " + error.message);
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else router.push("/(tabs)/menu");
                    }} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Sepetim</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <ThemeSwitcher />
                    {items.length > 0 && (
                        <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
                            <MaterialIcons name="delete-sweep" size={24} color={colors.danger} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="remove-shopping-cart" size={64} color={colors.tabIconDefault} />
                        <Text style={styles.emptyText}>Sepetiniz boş</Text>
                        <TouchableOpacity style={styles.goMenuBtn} onPress={() => router.push("/(tabs)/menu")}>
                            <Text style={styles.goMenuBtnText}>Menüye Dön</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    items.map((item) => (
                        <View key={item.id} style={styles.cartItem}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.is_package && item.selections && (
                                    <View style={styles.selectionsList}>
                                        {item.selections.map((sel, idx) => (
                                            <Text key={idx} style={styles.selectionText}>
                                                • {sel.item_name}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                                <Text style={styles.itemPrice}>{item.price} ₺ x {item.quantity}</Text>
                            </View>
                            <View style={styles.itemActions}>
                                <Text style={styles.itemTotal}>{item.price * item.quantity} ₺</Text>
                                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                                    <MaterialIcons name="close" size={20} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {items.length > 0 && (
                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <Text style={styles.orderTypeLabel}>Sipariş Türü Seçiniz:</Text>
                    <View style={styles.orderTypeContainer}>
                        <TouchableOpacity
                            style={[styles.orderTypeBtn, orderType === "Şimdi Ye" && styles.orderTypeBtnActive]}
                            onPress={() => setOrderType("Şimdi Ye")}
                        >
                            <MaterialIcons name="restaurant" size={20} color={orderType === "Şimdi Ye" ? "#fff" : colors.muted} />
                            <Text style={[styles.orderTypeBtnText, orderType === "Şimdi Ye" && { color: '#fff' }]}>Şimdi Ye</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.orderTypeBtn, orderType === "Sonra Ye (Gel-Al)" && styles.orderTypeBtnActive]}
                            onPress={() => setOrderType("Sonra Ye (Gel-Al)")}
                        >
                            <MaterialIcons name="shopping-bag" size={20} color={orderType === "Sonra Ye (Gel-Al)" ? "#fff" : colors.muted} />
                            <Text style={[styles.orderTypeBtnText, orderType === "Sonra Ye (Gel-Al)" && { color: '#fff' }]}>Gel-Al</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalText}>Toplam</Text>
                        <Text style={styles.totalAmount}>{getTotal()} ₺</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.checkoutBtn, isSubmitting && { opacity: 0.7 }]}
                        onPress={handleCheckout}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.checkoutBtnText}>
                            {isSubmitting ? "Sipariş Alınıyor..." : "Siparişi Onayla"}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    title: { fontSize: 28, fontWeight: "900", color: colors.text },
    clearBtn: {
        padding: 8,
        backgroundColor: colors.dangerBg,
        borderRadius: 12,
    },
    listContainer: {
        padding: 24,
        paddingBottom: 40,
        flexGrow: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.muted,
        marginTop: 16,
        marginBottom: 24,
    },
    goMenuBtn: {
        backgroundColor: colors.text,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 16,
    },
    goMenuBtnText: {
        color: colors.background,
        fontWeight: 'bold',
        fontSize: 16,
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    itemInfo: {
        flex: 1,
        marginRight: 16,
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    selectionsList: {
        marginTop: 4,
        marginBottom: 8,
        paddingLeft: 4,
    },
    selectionText: {
        fontSize: 12,
        color: colors.muted,
        marginBottom: 2,
    },
    itemPrice: {
        fontSize: 14,
        color: colors.muted,
        fontWeight: '500',
    },
    itemActions: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    itemTotal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    removeBtn: {
        padding: 6,
        backgroundColor: colors.dangerBg,
        borderRadius: 8,
    },
    footer: {
        backgroundColor: colors.surface,
        paddingHorizontal: 24,
        paddingTop: 20,
        borderTopWidth: 1,
        borderColor: colors.surfaceBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 10,
    },
    orderTypeLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.muted,
        marginBottom: 12,
    },
    orderTypeContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    orderTypeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    orderTypeBtnActive: {
        backgroundColor: colors.text,
        borderColor: colors.text,
    },
    orderTypeBtnText: {
        fontWeight: 'bold',
        color: colors.muted,
        fontSize: 14,
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    totalText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    totalAmount: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.primary,
    },
    checkoutBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    checkoutBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
