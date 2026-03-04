import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useMenu } from "@/lib/hooks/useMenu";
import { menuService } from "@/lib/services/menuService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useNavigation } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORIES = [
    { id: "ANA YEMEK", label: "ANA YEMEK" },
    { id: "YARDIMCI", label: "YARDIMCI" },
    { id: "ÇORBA", label: "ÇORBA ÇEŞİTLERİ" },
    { id: "EKSTRA", label: "EKSTRA FARKLAR" },
    { id: "İÇECEK", label: "İÇECEKLER" }
];

const SYS_CATEGORIES = [
    { id: "TABLDOT", label: "TABLDOT MENÜ" },
    { id: "TEK ÇEŞİT", label: "TEK ÇEŞİT" },
    { id: "EKSTRA", label: "EKSTRA FARKLARI" },
    { id: "İÇECEK", label: "İÇECEKLER" }
];

export default function AdminMenuAdd() {
    const { menu, systemPrices, loading, refetch } = useMenu(false);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [mainTab, setMainTab] = useState<"GUNUN_MENUSU" | "SABIT_LISTE">("GUNUN_MENUSU");

    useFocusEffect(
        React.useCallback(() => {
            refetch();
        }, [])
    );

    const [newItem, setNewItem] = useState({
        name: "",
        category: "ANA YEMEK",
        price: "180",
        image_url: "",
        image_base64: "",
    });

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string, name: string, category: string, price: string } | null>(null);

    const handleCategorySelect = (categoryId: string) => {
        let defaultPrice = "";
        if (systemPrices && systemPrices.length > 0) {
            const matchedSys = systemPrices.find(s => s.category === "TEK ÇEŞİT" && s.name.includes(categoryId));
            if (matchedSys) defaultPrice = matchedSys.price.toString();
        }
        setNewItem(prev => ({ ...prev, category: categoryId, price: defaultPrice || prev.price }));
    };

    const handleToggleStatus = async (id: string, newStatus: string) => {
        try {
            await menuService.toggleItemStatus(id, newStatus as any);
            refetch();
        } catch (error: any) {
            Alert.alert("Hata", "Durum güncellenemedi: " + error.message);
        }
    };

    const handleAddIndividual = async () => {
        if (!newItem.name || !newItem.price) {
            Alert.alert("Uyarı", "Lütfen isim ve fiyat giriniz.");
            return;
        }

        try {
            await menuService.addMenuItem(newItem.name, newItem.category, Number(newItem.price), newItem.image_url, newItem.image_base64);
            Alert.alert("Başarılı", `${newItem.name} listeye eklendi! (Henüz yayınlanmadı)`);
            setNewItem({ name: "", category: newItem.category, price: "", image_url: "", image_base64: "" });
            refetch();
        } catch (error: any) {
            Alert.alert("Hata", "Yemek eklenirken bir sorun oluştu: " + error.message);
        }
    };

    const handleEditItem = (item: any) => {
        setEditingItem({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price.toString()
        });
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editingItem || !editingItem.name || !editingItem.price) {
            Alert.alert("Hata", "Lütfen isim ve fiyat giriniz.");
            return;
        }
        try {
            await menuService.updateMenuItem(editingItem.id, {
                name: editingItem.name,
                category: editingItem.category,
                price: Number(editingItem.price)
            });
            Alert.alert("Başarılı", "Düzenleme kaydedildi.");
            setEditModalVisible(false);
            setEditingItem(null);
            refetch();
        } catch (error: any) {
            Alert.alert("Hata", "Güncelleme başarısız: " + error.message);
        }
    };

    const handlePickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setNewItem({ ...newItem, image_url: result.assets[0].uri, image_base64: result.assets[0].base64 || "" });
        }
    };

    const handleDeleteItem = (id: string) => {
        Alert.alert("Emin misiniz?", "Bu listeyi menüden tamamen siliyorsunuz!", [
            { text: "İptal", style: "cancel" },
            {
                text: "Sil", style: "destructive", onPress: async () => {
                    try {
                        await menuService.deleteMenuItem(id);
                        refetch();
                    } catch (error: any) {
                        Alert.alert("Hata", "Silme işlemi başarısız: " + error.message);
                    }
                }
            }
        ])
    };

    const handlePublishMenu = async () => {
        const hasDrafts = (menu || []).some((item: any) => item.status === 'draft');
        if (!hasDrafts) {
            Alert.alert("Bilgi", "Müşterilere açılacak yeni bir liste bulunmuyor.");
            return;
        }
        Alert.alert(
            "Yayınla ve Bildirim Gönder",
            "Bugünün menüsünü müşterilerin ekranına açıp, bildirim gönderiyorsunuz. Onaylıyor musunuz?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "YAYINLA",
                    style: "default",
                    onPress: async () => {
                        try {
                            await menuService.publishDraftMenu();
                            Alert.alert("Başarılı", "Bildirim gönderildi ve Yemekler Müşterilere açıldı!");
                            refetch();
                        } catch (e: any) {
                            Alert.alert("Hata", "Yayına alınırken hata oluştu: " + e.message);
                        }
                    }
                }
            ]
        );
    };

    const combinedMenu = (menu || []).filter((item: any) => item.status !== 'passive');
    const sysMenu = systemPrices || [];

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Menü Yönetimi</Text>
                        <Text style={styles.subtitle}>GÜNLÜK MENÜ & FİYAT TABELASI</Text>
                    </View>
                </View>
                <ThemeSwitcher />
            </View>

            <View style={styles.tabToggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, mainTab === "GUNUN_MENUSU" && styles.activeToggleBtn]}
                    onPress={() => setMainTab("GUNUN_MENUSU")}
                >
                    <Text style={[styles.toggleBtnText, mainTab === "GUNUN_MENUSU" && styles.activeToggleBtnText]}>
                        GÜNÜN MENÜSÜ AĞI
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, mainTab === "SABIT_LISTE" && styles.activeToggleBtn]}
                    onPress={() => setMainTab("SABIT_LISTE")}
                >
                    <Text style={[styles.toggleBtnText, mainTab === "SABIT_LISTE" && styles.activeToggleBtnText]}>
                        SABİT FİYAT TABELASI
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ------------------ SABİT LİSTE TAB (TABELA) ------------------ */}
                {mainTab === "SABIT_LISTE" && (
                    <View>
                        <View style={styles.infoBox}>
                            <MaterialIcons name="info-outline" size={24} color={colors.info} />
                            <Text style={styles.infoText}>Bu alandaki fiyatlar doğrudan işletmenizin fiziki tabelasındaki fiyatları simgeler. Müşteri fiyatları buradan beslenir.</Text>
                        </View>

                        <View style={styles.listContainer}>
                            {SYS_CATEGORIES.map(cat => {
                                const items = sysMenu.filter((item: any) => item.category === cat.id);
                                if (items.length === 0) return null;
                                return (
                                    <View key={cat.id} style={{ marginBottom: 24 }}>
                                        <View style={styles.categoryTitleBox}>
                                            <MaterialIcons name={
                                                cat.id === "TABLDOT" ? "restaurant-menu" :
                                                    cat.id === "TEK ÇEŞİT" ? "room-service" :
                                                        cat.id === "İÇECEK" ? "local-drink" : "star"
                                            } size={20} color={colors.primary} />
                                            <Text style={styles.categoryTitleText}>{cat.label}</Text>
                                            <View style={styles.categoryTitleLine} />
                                        </View>

                                        {items.map((item: any) => (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.systemItemCard}
                                                onPress={() => handleEditItem(item)}
                                            >
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={styles.systemItemName}>{item.name}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                        <Text style={styles.systemItemPrice}>₺{item.price}</Text>
                                                        <MaterialIcons name="edit" size={18} color={colors.muted} />
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ------------------ GÜNÜN MENÜSÜ TAB ------------------ */}
                {mainTab === "GUNUN_MENUSU" && (
                    <View>
                        <TouchableOpacity style={styles.publishBtnBox} onPress={handlePublishMenu}>
                            <MaterialIcons name="notifications-active" size={28} color="#fff" />
                            <Text style={styles.publishBtnBoxText}>YAYINLA VE YENİ BİLDİRİM GÖNDER</Text>
                        </TouchableOpacity>

                        <View style={styles.formContainer}>
                            <Text style={styles.sectionHeader}>YENİ YEMEK OLUŞTUR / EKLE</Text>
                            <InputField
                                label="YEMEK ADI"
                                icon="restaurant"
                                value={newItem.name}
                                onChangeText={(t: string) => setNewItem({ ...newItem, name: t })}
                                colors={colors}
                                styles={styles}
                            />
                            <View style={styles.categoryContainer}>
                                <Text style={styles.inputLabel}>KATEGORİ *</Text>
                                <View style={styles.categoryGrid}>
                                    {CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[styles.catBtn, newItem.category === cat.id && styles.activeCatBtn]}
                                            onPress={() => handleCategorySelect(cat.id)}
                                        >
                                            <Text style={[styles.catText, newItem.category === cat.id && styles.activeCatText]}>{cat.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={styles.imagePickerContainer}>
                                <Text style={styles.inputLabel}>FOTOĞRAF (İsteğe Bağlı)</Text>
                                <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
                                    {newItem.image_url ? (
                                        <Image source={{ uri: newItem.image_url }} style={styles.previewImage} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="add-a-photo" size={24} color={colors.muted} />
                                            <Text style={styles.imagePickerText}>Fotoğraf Seç</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                {newItem.image_url ? (
                                    <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setNewItem({ ...newItem, image_url: "" })}>
                                        <Text style={{ color: colors.danger, fontSize: 13, textAlign: "center" }}>Fotoğrafı Kaldır</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <InputField
                                label="FİYATI (₺)"
                                icon="payments"
                                keyboardType="numeric"
                                value={newItem.price}
                                onChangeText={(t: string) => setNewItem({ ...newItem, price: t })}
                                colors={colors}
                                styles={styles}
                            />
                            <TouchableOpacity style={styles.addBtn} onPress={handleAddIndividual}>
                                <Text style={styles.addBtnText}>DOĞRUDAN LİSTEYE EKLE</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.listContainer}>
                            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>GÜNÜN YEMEKLERİ LİSTESİ</Text>
                            {CATEGORIES.map(cat => {
                                const items = combinedMenu.filter((item: any) => item.category === cat.id);
                                if (items.length === 0) return null;
                                return (
                                    <View key={cat.id} style={{ marginBottom: 12 }}>
                                        <View style={styles.categoryTitleBox}>
                                            <Text style={styles.categoryTitleText}>{cat.label}</Text>
                                            <View style={styles.categoryTitleLine} />
                                        </View>
                                        {items.map((item: any) => (
                                            <ItemCard
                                                key={item.id}
                                                item={item}
                                                handleToggleStatus={handleToggleStatus}
                                                handleEditItem={handleEditItem}
                                                handleDeleteItem={handleDeleteItem}
                                                colors={colors}
                                                styles={styles}
                                            />
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Edit Modal (Ortak Kullanım) */}
            {editingItem && (
                <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
                    <View style={[styles.modalContainer, { paddingTop: insets.top + 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{mainTab === 'SABIT_LISTE' ? "Tabela Fiyatını Düzenle" : "Yemeği Düzenle"}</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <MaterialIcons name="close" size={28} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formContainerInner}>
                            <InputField
                                label={mainTab === 'SABIT_LISTE' ? "BAŞLIK İSMİ" : "ÖĞE ADI"}
                                icon="edit"
                                value={editingItem.name}
                                onChangeText={(t: string) => setEditingItem(prev => prev ? { ...prev, name: t } : null)}
                                colors={colors}
                                styles={styles}
                            />

                            {/* Sistem fiyatları için kategori değiştirmeye gerek yok */}
                            {mainTab !== 'SABIT_LISTE' && (
                                <View style={styles.categoryContainer}>
                                    <Text style={styles.inputLabel}>KATEGORİ *</Text>
                                    <View style={styles.categoryGrid}>
                                        {CATEGORIES.map(cat => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[styles.catBtn, editingItem.category === cat.id && styles.activeCatBtn]}
                                                onPress={() => setEditingItem(prev => prev ? { ...prev, category: cat.id } : null)}
                                            >
                                                <Text style={[styles.catText, editingItem.category === cat.id && styles.activeCatText]}>{cat.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <InputField
                                label="BİRİM FİYAT (₺)"
                                icon="payments"
                                keyboardType="numeric"
                                value={editingItem.price}
                                onChangeText={(t: string) => setEditingItem(prev => prev ? { ...prev, price: t } : null)}
                                colors={colors}
                                styles={styles}
                            />

                            <TouchableOpacity style={styles.addBtn} onPress={handleSaveEdit}>
                                <Text style={styles.addBtnText}>GÜNCELLE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const ItemCard = ({ item, handleToggleStatus, handleEditItem, handleDeleteItem, colors, styles }: any) => {
    const isSoldOut = item.status === 'sold_out';
    const isDraft = item.status === 'draft';

    return (
        <View style={[styles.menuItemCard, isSoldOut && { opacity: 0.6 }]}>
            <View style={styles.menuItemContent}>
                <View style={[styles.menuItemImagePlaceholder, { backgroundColor: colors.cardHighlight, overflow: 'hidden' }]}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                    ) : (
                        <MaterialIcons name={
                            item.category === "İÇECEK" ? "local-drink" :
                                item.category === "ÇORBA" ? "soup-kitchen" : "restaurant"
                        } size={28} color={colors.primary} />
                    )}
                </View>
                <View style={styles.menuItemTextCont}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.menuItemName}>{item.name}</Text>
                        {isDraft && <Text style={{ fontSize: 9, color: colors.warning, fontWeight: 'bold' }}>(YAYINLANMADI)</Text>}
                    </View>
                    <Text style={styles.menuItemDetails}>₺{item.price}</Text>
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6, marginTop: 12 }}>
                <TouchableOpacity
                    style={[styles.toggleActiveBtn, isSoldOut && styles.inactiveBtn, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => handleToggleStatus(item.id, isSoldOut ? 'active' : 'sold_out')}
                >
                    <MaterialIcons name={isSoldOut ? "event-available" : "not-interested"} size={16} color={isSoldOut ? colors.primary : colors.danger} />
                    <Text style={[styles.toggleActiveText, isSoldOut && styles.inactiveText]}>
                        {isSoldOut ? 'TEKRAR AKTİF ET' : 'TÜKENDİ İŞARETLE'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.editBtn} onPress={() => handleEditItem(item)}>
                    <MaterialIcons name="edit" size={18} color={colors.info} />
                    <Text style={{ fontSize: 9, fontWeight: "bold", color: colors.info, marginLeft: 4 }}>DÜZENLE</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteItem(item.id)}>
                    <MaterialIcons name="delete" size={18} color={colors.danger} />
                    <Text style={{ fontSize: 9, fontWeight: "bold", color: colors.danger, marginLeft: 4 }}>SİL</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const InputField = ({ label, icon, value, onChangeText, keyboardType = "default", colors, styles }: any) => (
    <View style={styles.inputWrapper}>
        <View style={styles.inputIconRow}>
            <MaterialIcons name={icon} size={16} color={colors.muted} />
            <Text style={styles.inputLabel}>{label}</Text>
        </View>
        <TextInput
            style={styles.input}
            placeholder="Giriş yapınız..."
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
        />
    </View>
);

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    subtitle: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 },
    tabToggleContainer: { flexDirection: "row", backgroundColor: colors.surfaceBorder, padding: 6, borderRadius: 20, marginHorizontal: 24, marginBottom: 20 },
    toggleBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    activeToggleBtn: { backgroundColor: colors.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    toggleBtnText: { fontSize: 10, fontWeight: "900", color: colors.muted, letterSpacing: 1 },
    activeToggleBtnText: { color: colors.primary },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.infoBg, padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.surfaceBorder },
    infoText: { flex: 1, fontSize: 11, color: colors.info, lineHeight: 18 },
    sectionHeader: { fontSize: 12, fontWeight: "900", color: colors.muted, letterSpacing: 1.5, marginBottom: 16 },
    formContainer: { backgroundColor: colors.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 20 },
    formContainerInner: { paddingHorizontal: 24, paddingBottom: 40 },
    inputWrapper: { marginBottom: 16 },
    inputIconRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, marginLeft: 4 },
    inputLabel: { fontSize: 9, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5 },
    input: { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: "bold", color: colors.text, borderWidth: 1, borderColor: colors.surfaceBorder },
    categoryContainer: { marginBottom: 16 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder },
    activeCatBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
    catText: { fontSize: 9, fontWeight: 'bold', color: colors.muted },
    activeCatText: { color: '#fff' },
    addBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
    addBtnText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
    publishBtnBox: { backgroundColor: colors.info, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: "center", justifyContent: 'center', gap: 10, marginBottom: 24, shadowColor: colors.info, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    publishBtnBoxText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
    listContainer: { marginTop: 8 },
    menuItemCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 12 },
    menuItemContent: { flexDirection: "row", alignItems: "center", gap: 16 },
    menuItemImagePlaceholder: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    menuItemTextCont: { flex: 1 },
    menuItemName: { fontSize: 15, fontWeight: "bold", color: colors.text, marginBottom: 4 },
    menuItemDetails: { fontSize: 12, fontWeight: "900", color: colors.primary },
    deleteBtn: { flexDirection: 'row', paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
    toggleActiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.cardHighlight, borderWidth: 1, borderColor: colors.surfaceBorder },
    inactiveBtn: { backgroundColor: colors.dangerBg, borderColor: colors.surfaceBorder },
    toggleActiveText: { fontSize: 9, fontWeight: 'bold', color: colors.primary },
    inactiveText: { color: colors.danger },
    imagePickerContainer: { marginBottom: 16 },
    imagePickerBtn: { height: 100, backgroundColor: colors.background, borderWidth: 1, borderStyle: "dashed", borderColor: colors.surfaceBorder, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8, overflow: "hidden" },
    imagePickerText: { marginTop: 8, color: colors.muted, fontSize: 12, fontWeight: "500" },
    previewImage: { width: "100%", height: "100%", borderRadius: 12 },
    categoryTitleBox: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
    categoryTitleText: { fontSize: 13, fontWeight: "bold", color: colors.text, letterSpacing: 1 },
    categoryTitleLine: { flex: 1, height: 1, backgroundColor: colors.surfaceBorder },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    editBtn: { flexDirection: 'row', paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.infoBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
    systemItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.surfaceBorder },
    systemItemName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    systemItemPrice: { fontSize: 15, fontWeight: '900', color: colors.primary }
});
