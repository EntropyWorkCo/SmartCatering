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
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/hooks/useAuth";
import { useProfile } from "../../lib/hooks/useProfile";
import { adisyonService } from "../../lib/services/adisyonService";
import { notificationService } from "../../lib/services/notificationService";

export default function CartScreen() {
    const { items, removeItem, clearCart, getTotal, addItem, decrementItem } = useCartStore();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { user, isAdmin } = useAuth();
    const { profile } = useProfile(user?.id);
    const isCompany = profile?.is_company || false;

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const orderMode = useCartStore((state) => state.orderMode);
    const orderType = orderMode === "eat_now" ? "Şimdi Ye" : "Sipariş Ver";
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [orderNote, setOrderNote] = useState("");
    const [hasGuest, setHasGuest] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-fill address and phone from profile
    React.useEffect(() => {
        if (profile) {
            // For corporate users
            if (profile.corporate_info) {
                if (profile.corporate_info.invoiceAddress && !address) {
                    setAddress(profile.corporate_info.invoiceAddress);
                }
                if (profile.corporate_info.companyPhone && !phone) {
                    setPhone(profile.corporate_info.companyPhone);
                } else if (profile.phone && !phone) {
                    setPhone(profile.phone);
                }
            } else {
                // For individual users
                if (profile.phone && !phone) {
                    setPhone(profile.phone);
                }
            }
        }
    }, [profile]);

    const handleClearCart = () => {
        clearCart();
        setOrderNote("");
        setHasGuest(false);
    };

    const handleCheckout = async () => {
        if (!user) {
            Alert.alert("Hata", "Sipariş verebilmek için giriş yapmalısınız.");
            return;
        }

        if (items.length === 0) {
            Alert.alert("Sepet Boş", "Lütfen önce menüden ürün ekleyin.");
            return;
        }

        if (orderType === "Sipariş Ver") {
            if (!address.trim()) {
                Alert.alert("Hata", "Lütfen siparişinize devam etmek için teslimat adresini giriniz.");
                return;
            }
            if (!phone.trim()) {
                Alert.alert("Hata", "Lütfen siparişinize devam etmek için iletişim telefonunu giriniz.");
                return;
            }
        }

        Alert.alert(
            "Siparişi Onayla",
            `${isCompany ? '' : `${getTotal()}₺ tutarındaki `}siparişinizi onaylıyor musunuz?\nSipariş Türü: ${orderType}`,
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Onayla",
                    style: "default",
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const noteContent = `${orderNote ? `Not: ${orderNote}` : ""}`;
                            const addressInfo = orderType === "Sipariş Ver" ? `[Adres: ${address}] [Tel: ${phone}] ` : "";
                            const note = `${addressInfo}${hasGuest ? '[MİSAFİRLE BERABER] ' : ''}${noteContent}`.trim();
                            const adisyon = await adisyonService.createOrder(
                                user.id,
                                getTotal(),
                                items,
                                orderType,
                                note,
                                isCompany
                            );

                            clearCart();
                            setOrderNote("");
                            setHasGuest(false);
                            
                            // Skip rating notification for admins
                            if (!isAdmin) {
                                await notificationService.scheduleRatingNotification(15, adisyon.id);
                            }

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
                        <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
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
                                                • {sel.item_name} ({sel.category})
                                            </Text>
                                        ))}
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    {!isCompany && <Text style={[styles.itemPrice, { marginRight: 16 }]}>{item.price} ₺</Text>}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 4, gap: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                                        <TouchableOpacity 
                                            onPress={() => decrementItem(item.menu_item_id)} 
                                            style={{ backgroundColor: colors.surface, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder }}>
                                            <MaterialIcons name="remove" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{item.quantity}</Text>
                                        <TouchableOpacity 
                                            onPress={() => addItem({ menu_item_id: item.menu_item_id, name: item.name, price: item.price, quantity: 1, is_package: item.is_package, selections: item.selections })} 
                                            style={{ backgroundColor: colors.primary, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                                            <MaterialIcons name="add" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.itemActions}>
                                {isCompany ? null : <Text style={styles.itemTotal}>{item.price * item.quantity} ₺</Text>}
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
                    <View style={styles.noteContainer}>
                        {orderType === "Sipariş Ver" && (
                            <>
                                <Text style={[styles.orderTypeLabel, { marginBottom: 8 }]}>Teslimat Adresi:</Text>
                                <TextInput
                                    style={[styles.noteInput, { minHeight: 48, marginBottom: 12 }]}
                                    placeholder="Açık adres, bina, kat, daire giriniz..."
                                    placeholderTextColor={colors.muted}
                                    value={address}
                                    onChangeText={setAddress}
                                    multiline
                                />
                                <Text style={[styles.orderTypeLabel, { marginBottom: 8 }]}>İletişim Telefonu:</Text>
                                <TextInput
                                    style={[styles.noteInput, { minHeight: 48, marginBottom: 16 }]}
                                    placeholder="5XX XXX XX XX"
                                    placeholderTextColor={colors.muted}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </>
                        )}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.orderTypeLabel, { marginBottom: 0 }]}>Sipariş Notu (Opsiyonel):</Text>
                            <TouchableOpacity 
                                onPress={() => setHasGuest(!hasGuest)}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 6,
                                    backgroundColor: hasGuest ? colors.primary + '15' : 'transparent',
                                    paddingHorizontal: 12, paddingVertical: 6,
                                    borderRadius: 12, borderWidth: 1, borderColor: hasGuest ? colors.primary : colors.surfaceBorder
                                }}>
                                <MaterialIcons name={hasGuest ? "check-box" : "check-box-outline-blank"} size={18} color={hasGuest ? colors.primary : colors.muted} />
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: hasGuest ? colors.primary : colors.text }}>Misafirim Var</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.noteInput}
                            placeholder="Örn: Bol acılı olsun..."
                            placeholderTextColor={colors.muted}
                            value={orderNote}
                            onChangeText={setOrderNote}
                            multiline
                        />
                    </View>



                    <View style={styles.totalContainer}>
                        <Text style={styles.totalText}>Toplam</Text>
                        <Text style={styles.totalAmount}>{isCompany ? "-" : `${getTotal()} ₺`}</Text>
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
    noteContainer: {
        marginBottom: 20,
    },
    noteInput: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 12,
        padding: 12,
        color: colors.text,
        minHeight: 80,
        textAlignVertical: 'top',
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
        backgroundColor: colors.primary,
        borderColor: colors.primary,
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
