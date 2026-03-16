import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useMenu } from "@/lib/hooks/useMenu";
import { menuService } from "@/lib/services/menuService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
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
    { id: "TEK ÇEŞİT", label: "TEK ÇEŞİT" },
    { id: "EKSTRA", label: "EKSTRA FARKLARI" },
    { id: "İÇECEK", label: "İÇECEKLER" },
    { id: "TABLDOT", label: "TABLDOT MENÜ" }
];

export default function AdminMenuAdd() {
    const { menu, systemPrices, loading, refetch } = useMenu(false);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [mainTab, setMainTab] = useState<"ADD_MEAL" | "POOL" | "TODAY" | "FIXED">("TODAY");

    useFocusEffect(
        React.useCallback(() => {
            refetch();
        }, [])
    );

    const [bulkItems, setBulkItems] = useState([{
        id: Date.now().toString(),
        name: "",
        category: "ANA YEMEK",
        price: "180",
        image_url: "",
        image_base64: ""
    }]);

    const handleAddBulkRow = () => {
        setBulkItems(prev => {
            const lastItem = prev[prev.length - 1];
            return [...prev, {
                id: Date.now().toString() + Math.random().toString(),
                name: "",
                category: lastItem ? lastItem.category : "ANA YEMEK",
                price: lastItem ? lastItem.price : "180",
                image_url: "",
                image_base64: ""
            }];
        });
    };

    const handleRemoveBulkRow = (id: string) => {
        if (bulkItems.length === 1) return;
        setBulkItems(prev => prev.filter(item => item.id !== id));
    };

    const handleBulkCategorySelect = (id: string, categoryId: string) => {
        let defaultPrice = "";
        if (systemPrices && systemPrices.length > 0) {
            const matchedSys = systemPrices.find(s => s.category === "TEK ÇEŞİT" && s.name.includes(categoryId));
            if (matchedSys) defaultPrice = matchedSys.price.toString();
        }
        setBulkItems(prev => prev.map(item => item.id === id ? { ...item, category: categoryId, price: defaultPrice || item.price } : item));
    };

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string, name: string, category: string, price: string, image_url?: string, image_base64?: string } | null>(null);

    const handleToggleStatus = async (id: string, newStatus: string) => {
        try {
            await menuService.toggleItemStatus(id, newStatus as any);
            refetch();
        } catch (error: any) {
            Alert.alert("Hata", "Durum güncellenemedi: " + error.message);
        }
    };

    const handleSaveBulk = async () => {
        const invalidItems = bulkItems.filter(item => item.name.trim() === "");
        if (invalidItems.length > 0) {
            Alert.alert("Uyarı", "Lütfen tüm yemeklerin adını eksiksiz giriniz.");
            return;
        }

        try {
            setIsSaving(true);
            for (const item of bulkItems) {
                await menuService.addMenuItem(
                    item.name.trim(),
                    item.category,
                    Number(item.price),
                    item.image_url,
                    item.image_base64
                );
            }
            Alert.alert("Başarılı", `${bulkItems.length} adet yemek Havuza eklendi!`);
            setBulkItems([{ id: Date.now().toString(), name: "", category: "ANA YEMEK", price: "180", image_url: "", image_base64: "" }]);
            refetch();
            setMainTab("POOL");
        } catch (error: any) {
            Alert.alert("Hata", "Yemekler eklenirken bir sorun oluştu: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditItem = (item: any) => {
        setEditingItem({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price.toString(),
            image_url: item.image_url || ""
        });
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editingItem || !editingItem.name) {
            Alert.alert("Hata", "Lütfen isim giriniz.");
            return;
        }
        try {
            await menuService.updateMenuItem(editingItem.id, {
                name: editingItem.name,
                category: editingItem.category,
                price: Number(editingItem.price),
                image_url: editingItem.image_url,
                image_base64: editingItem.image_base64
            });
            Alert.alert("Başarılı", "Düzenleme kaydedildi.");
            setEditModalVisible(false);
            setEditingItem(null);
            refetch();
        } catch (error: any) {
            Alert.alert("Hata", "Güncelleme başarısız: " + error.message);
        }
    };

    const handlePickImageForBulk = async (id: string) => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setBulkItems(prev => prev.map(item => item.id === id ? { ...item, image_url: result.assets[0].uri, image_base64: result.assets[0].base64 || "" } : item));
        }
    };

    const handlePickEditImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && editingItem) {
            setEditingItem({ ...editingItem, image_url: result.assets[0].uri, image_base64: result.assets[0].base64 || "" });
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

    const allMenuItems = menu || [];
    const todayMenu = allMenuItems.filter((item: any) => ['draft', 'active', 'sold_out'].includes(item.status));
    const poolMenu = allMenuItems;
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
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Menü Yönetimi</Text>
                        <Text style={styles.subtitle}>GÜNLÜK MENÜ & FİYAT TABELASI</Text>
                    </View>
                </View>
                <ThemeSwitcher />
            </View>

            <View style={{ marginBottom: 20 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabToggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mainTab === "ADD_MEAL" && styles.activeToggleBtn]}
                        onPress={() => setMainTab("ADD_MEAL")}
                    >
                        <Text style={[styles.toggleBtnText, mainTab === "ADD_MEAL" && styles.activeToggleBtnText]}>
                            YENİ YEMEK EKLE
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mainTab === "POOL" && styles.activeToggleBtn]}
                        onPress={() => setMainTab("POOL")}
                    >
                        <Text style={[styles.toggleBtnText, mainTab === "POOL" && styles.activeToggleBtnText]}>
                            YEMEK HAVUZU
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mainTab === "TODAY" && styles.activeToggleBtn]}
                        onPress={() => setMainTab("TODAY")}
                    >
                        <Text style={[styles.toggleBtnText, mainTab === "TODAY" && styles.activeToggleBtnText]}>
                            GÜNÜN MENÜSÜ
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mainTab === "FIXED" && styles.activeToggleBtn]}
                        onPress={() => setMainTab("FIXED")}
                    >
                        <Text style={[styles.toggleBtnText, mainTab === "FIXED" && styles.activeToggleBtnText]}>
                            SABİT FİYAT LİSTESİ
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. YENİ YEMEK EKLE TAB */}
                {mainTab === "ADD_MEAL" && (
                    <View style={[styles.formContainer, { marginTop: 10, paddingHorizontal: 0, paddingBottom: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}>
                        <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                            <Text style={[styles.sectionHeader, { fontSize: 16 }]}>➕ TOPLU YEMEK EKLE</Text>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Sıfırdan oluşturacağınız yemekleri listeye girip tek seferde "Yemek Havuzu"na kaydedebilirsiniz.</Text>
                        </View>

                        {bulkItems.map((bItem, index) => (
                            <View key={bItem.id} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={{ fontWeight: 'bold', color: colors.primary }}>Yemek #{index + 1}</Text>
                                    {bulkItems.length > 1 && (
                                        <TouchableOpacity onPress={() => handleRemoveBulkRow(bItem.id)}>
                                            <MaterialIcons name="close" size={20} color={colors.danger} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <InputField
                                    label="YEMEK ADI *"
                                    icon="restaurant"
                                    value={bItem.name}
                                    onChangeText={(t: string) => setBulkItems(prev => prev.map(item => item.id === bItem.id ? { ...item, name: t } : item))}
                                    colors={colors}
                                    styles={styles}
                                />

                                <View style={styles.categoryContainer}>
                                    <Text style={styles.inputLabel}>KATEGORİ *</Text>
                                    <View style={styles.categoryGrid}>
                                        {CATEGORIES.map(cat => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[styles.catBtn, bItem.category === cat.id && styles.activeCatBtn]}
                                                onPress={() => handleBulkCategorySelect(bItem.id, cat.id)}
                                            >
                                                <Text style={[styles.catText, bItem.category === cat.id && styles.activeCatText]}>{cat.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        {/* Fiyat alanı admin tarafından gizlendi (Plandaki istek üzerine) */}
                                    </View>
                                    <View style={{ width: 80, alignItems: 'center' }}>
                                        <Text style={styles.inputLabel}>FOTO</Text>
                                        <TouchableOpacity style={[styles.imagePickerBtn, { width: '100%', height: 48, marginTop: 0, borderWidth: bItem.image_url ? 0 : 1 }]} onPress={() => handlePickImageForBulk(bItem.id)}>
                                            {bItem.image_url ? (
                                                <Image source={{ uri: bItem.image_url }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                                            ) : (
                                                <MaterialIcons name="add-a-photo" size={20} color={colors.muted} />
                                            )}
                                        </TouchableOpacity>
                                        {bItem.image_url ? (
                                            <TouchableOpacity style={{ marginTop: 4 }} onPress={() => setBulkItems(prev => prev.map(item => item.id === bItem.id ? { ...item, image_url: "", image_base64: "" } : item))}>
                                                <Text style={{ color: colors.danger, fontSize: 10 }}>Kaldır</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity style={{ padding: 16, alignItems: 'center', borderColor: colors.primary, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, marginBottom: 16, backgroundColor: colors.surface }} onPress={handleAddBulkRow}>
                            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>+ Yeni Yemek Satırı Ekle</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.addBtn} onPress={handleSaveBulk}>
                            <Text style={styles.addBtnText}>TÜM LİSTEYİ HAVUZA KAYDET</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2. YEMEK HAVUZU TAB */}
                {mainTab === "POOL" && (
                    <View style={[styles.formContainer, { marginTop: 10, backgroundColor: 'transparent', borderColor: 'transparent', padding: 0 }]}>
                        <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                            <Text style={[styles.sectionHeader, { fontSize: 16 }]}>🥘 TÜM YEMEKLER (KATALOG)</Text>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Sisteme daha önceden kaydedilen tüm yemekleriniz burada. "Günün Menüsüne Al" dediğiniz yemek yukarıdaki Günün Menüsü sekmesine geçer.</Text>
                        </View>

                        {CATEGORIES.map(cat => {
                            const items = poolMenu.filter((item: any) => item.category === cat.id);
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
                                            isPoolTab={true}
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
                        {poolMenu.length === 0 && (
                            <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40 }}>Havuzda bekleyen yemek yok.</Text>
                        )}
                    </View>
                )}

                {/* 3. GÜNÜN MENÜSÜ TAB */}
                {mainTab === "TODAY" && (
                    <View style={{ marginTop: 10 }}>
                        {todayMenu.some((item: any) => item.status === 'draft') && (
                            <TouchableOpacity style={styles.publishBtnBox} onPress={handlePublishMenu}>
                                <Text style={styles.publishBtnBoxText}>YAYINLA VE MÜŞTERİYE BİLDİRİM GÖNDER</Text>
                            </TouchableOpacity>
                        )}

                        {todayMenu.length > 0 ? (
                            <View style={[styles.formContainer, { backgroundColor: 'transparent', borderColor: 'transparent', padding: 0 }]}>
                                <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                                    <Text style={[styles.sectionHeader, { color: colors.primary, fontSize: 16 }]}>✅ BUGÜN ÇIKACAK YEMEKLER</Text>
                                    <Text style={{ fontSize: 12, color: colors.muted }}>Havuzdan seçilen yemekler buraya toplanır. Son kontrolü yaptıktan sonra YAYINLA butonunu kullanabilirsiniz.</Text>
                                </View>

                                {CATEGORIES.map(cat => {
                                    const items = todayMenu.filter((item: any) => item.category === cat.id);
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
                                                    isPoolTab={false}
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
                        ) : (
                            <View style={[styles.formContainer, { alignItems: 'center', paddingVertical: 40, marginTop: 20 }]}>
                                <Text style={{ fontWeight: 'bold', color: colors.text, marginBottom: 8, fontSize: 16 }}>Günün Menüsü Boş</Text>
                                <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>Yan sekmedeki "Yemek Havuzu"ndan o gün çıkacak yemekleri seçerek bugünün menüsünü oluşturabilirsiniz.</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* 4. SABİT FİYAT LİSTESİ TAB */}
                {mainTab === "FIXED" && (
                    <View style={{ marginTop: 10 }}>
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

            </ScrollView>

            {/* Edit Modal (Ortak Kullanım) */}
            {editingItem && (
                <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
                    <View style={[styles.modalContainer, { paddingTop: insets.top + 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{mainTab === 'FIXED' ? "Tabela Fiyatını Düzenle" : "Yemeği Düzenle"}</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <MaterialIcons name="close" size={28} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formContainerInner}>
                            <InputField
                                label={mainTab === 'FIXED' ? "BAŞLIK İSMİ" : "ÖĞE ADI"}
                                icon="edit"
                                value={editingItem.name}
                                onChangeText={(t: string) => setEditingItem(prev => prev ? { ...prev, name: t } : null)}
                                colors={colors}
                                styles={styles}
                            />

                            {/* Sistem fiyatları için kategori değiştirmeye gerek yok */}
                            {mainTab !== 'FIXED' && (
                                <>
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
                                    <View style={styles.imagePickerContainer}>
                                        <Text style={styles.inputLabel}>FOTOĞRAF (İsteğe Bağlı)</Text>
                                        <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickEditImage}>
                                            {editingItem.image_url ? (
                                                <Image source={{ uri: editingItem.image_url }} style={styles.previewImage} />
                                            ) : (
                                                <>
                                                    <MaterialIcons name="add-a-photo" size={24} color={colors.muted} />
                                                    <Text style={styles.imagePickerText}>Fotoğraf Seç / Değiştir</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        {editingItem.image_url ? (
                                            <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setEditingItem(prev => prev ? { ...prev, image_url: "" } : null)}>
                                                <Text style={{ color: colors.danger, fontSize: 13, textAlign: "center" }}>Fotoğrafı Kaldır</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </>
                            )}

                            {mainTab === 'FIXED' && (
                                <InputField
                                    label="BİRİM FİYAT (₺)"
                                    icon="payments"
                                    keyboardType="numeric"
                                    value={editingItem.price}
                                    onChangeText={(t: string) => setEditingItem(prev => prev ? { ...prev, price: t } : null)}
                                    colors={colors}
                                    styles={styles}
                                />
                            )}

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

const ItemCard = ({ item, isPoolTab, handleToggleStatus, handleEditItem, handleDeleteItem, colors, styles }: any) => {
    const isSoldOut = item.status === 'sold_out';
    const isDraft = item.status === 'draft';
    const isActive = item.status === 'active';
    const isPassive = item.status === 'passive';

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
                    </View>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {/* Fiyat gösterimi adminde gizlendi */}
                        {isDraft && <Text style={{ fontSize: 9, color: '#f59e0b', fontWeight: 'bold' }}>(YAYIN BEKLİYOR)</Text>}
                        {isActive && <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>(AKTİF)</Text>}
                        {isPassive && <Text style={{ fontSize: 9, color: colors.muted, fontWeight: 'bold' }}>(HAVUZDA)</Text>}
                    </View>
                </View>
            </View>
            <View style={[styles.menuItemActions, { flexWrap: 'wrap', gap: 8 }]}>
                {isPoolTab ? (
                    <>
                        {isPassive ? (
                            <TouchableOpacity
                                style={[styles.simpleActionBtn, { flex: 1, minWidth: '40%', backgroundColor: colors.primary, borderColor: colors.primary }]}
                                onPress={() => handleToggleStatus(item.id, 'draft')}
                            >
                                <Text style={[styles.simpleActionText, { color: '#fff' }]}>Günün Menüsüne Al</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.simpleActionBtn, { flex: 1, minWidth: '40%', backgroundColor: colors.surfaceBorder, borderColor: colors.surfaceBorder, opacity: 0.6 }]}>
                                <Text style={[styles.simpleActionText, { color: colors.muted }]}>Günün Menüsünde</Text>
                            </View>
                        )}

                        <TouchableOpacity style={[styles.simpleActionBtn, { flex: 1, minWidth: '20%' }]} onPress={() => handleEditItem(item)}>
                            <Text style={styles.simpleActionText}>Düzenle</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.simpleActionBtn, styles.dangerActionBtn, { flex: 0.5, minWidth: 40, alignItems: 'center', justifyContent: 'center' }]} onPress={() => handleDeleteItem(item.id)}>
                            <MaterialIcons name="delete" size={16} color={colors.danger} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {!isPassive && (
                            <TouchableOpacity
                                style={[styles.simpleActionBtn, { flex: 1, minWidth: '40%', borderColor: '#f59e0b', backgroundColor: colors.surface }]}
                                onPress={() => handleToggleStatus(item.id, 'passive')}
                            >
                                <Text style={[styles.simpleActionText, { color: '#f59e0b' }]}>Menüden Kaldır</Text>
                            </TouchableOpacity>
                        )}
                        {(isActive || isDraft) && (
                            <TouchableOpacity
                                style={[styles.simpleActionBtn, { flex: 1, minWidth: '40%', backgroundColor: colors.danger, borderColor: colors.danger }]}
                                onPress={() => handleToggleStatus(item.id, 'sold_out')}
                            >
                                <Text style={[styles.simpleActionText, { color: '#fff' }]}>Tükendi Olarak İşaretle</Text>
                            </TouchableOpacity>
                        )}
                        {isSoldOut && (
                            <TouchableOpacity
                                style={[styles.simpleActionBtn, { flex: 1, minWidth: '40%', backgroundColor: '#10b981', borderColor: '#10b981' }]}
                                onPress={() => handleToggleStatus(item.id, 'active')}
                            >
                                <Text style={[styles.simpleActionText, { color: '#fff' }]}>Tekrar Satışa Aç</Text>
                            </TouchableOpacity>
                        )}

                        {(isDraft || isSoldOut || isActive) && (
                            <TouchableOpacity style={[styles.simpleActionBtn, { flex: 1, minWidth: '20%' }]} onPress={() => handleEditItem(item)}>
                                <Text style={styles.simpleActionText}>Düzenle</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

const InputField = ({ label, value, onChangeText, keyboardType = "default", colors, styles }: any) => (
    <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>{label}</Text>
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
    subtitle: { fontSize: 10, color: colors.muted, marginTop: 4 },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    systemItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.surfaceBorder },
    systemItemName: { fontSize: 14, fontWeight: '500', color: colors.text },
    systemItemPrice: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    tabToggleContainer: { flexDirection: "row", paddingHorizontal: 24 },
    toggleBtn: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent", alignItems: "center" },
    activeToggleBtn: { borderBottomColor: colors.primary },
    toggleBtnText: { fontSize: 12, fontWeight: "bold", color: colors.muted },
    activeToggleBtnText: { color: colors.primary },
    infoBox: { backgroundColor: colors.surfaceBorder, padding: 12, borderRadius: 8, marginBottom: 20 },
    infoText: { fontSize: 12, color: colors.text },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
    sectionHeader: { fontSize: 14, fontWeight: "bold", color: colors.text, marginBottom: 16 },
    formContainer: { backgroundColor: colors.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 24 },
    formContainerInner: { paddingHorizontal: 24, paddingBottom: 40 },
    inputWrapper: { marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: "bold", color: colors.muted, marginBottom: 8 },
    input: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceBorder },
    categoryContainer: { marginBottom: 16 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder },
    activeCatBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
    catText: { fontSize: 11, fontWeight: 'bold', color: colors.muted },
    activeCatText: { color: '#fff' },
    addBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
    addBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
    publishBtnBox: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: 'center', marginBottom: 24 },
    publishBtnBoxText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
    listContainer: { marginTop: 8 },
    menuItemCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 12 },
    menuItemContent: { flexDirection: "row", alignItems: "center", gap: 16 },
    menuItemImagePlaceholder: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    menuItemTextCont: { flex: 1 },
    menuItemName: { fontSize: 15, fontWeight: "bold", color: colors.text, marginBottom: 4 },
    menuItemDetails: { fontSize: 14, color: colors.muted },
    menuItemActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
    simpleActionBtn: { paddingVertical: 8, borderRadius: 6, backgroundColor: colors.background, alignItems: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
    activeActionBtn: { backgroundColor: colors.surfaceBorder },
    dangerActionBtn: { borderColor: colors.danger, backgroundColor: colors.background },
    simpleActionText: { fontSize: 11, fontWeight: 'bold', color: colors.text },
    activeActionText: { color: colors.muted },
    dangerActionText: { color: colors.danger },
    imagePickerContainer: { marginBottom: 16 },
    imagePickerBtn: { height: 100, backgroundColor: colors.background, borderWidth: 1, borderStyle: "dashed", borderColor: colors.surfaceBorder, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 4, overflow: "hidden" },
    imagePickerText: { marginTop: 4, color: colors.muted, fontSize: 12 },
    previewImage: { width: "100%", height: "100%", borderRadius: 8 },
    categoryTitleBox: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
    categoryTitleText: { fontSize: 14, fontWeight: "bold", color: colors.muted },
    categoryTitleLine: { flex: 1, height: 1, backgroundColor: colors.surfaceBorder }
});
