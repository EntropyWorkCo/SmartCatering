import { useMenu } from "@/lib/hooks/useMenu";
import { menuService } from "@/lib/services/menuService";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Orijinal menüye göre kategoriler
const CATEGORIES = [
    { id: "ANA YEMEK", label: "ANA YEMEK" },
    { id: "YARDIMCI", label: "YARDIMCI" },
    { id: "ÇORBA", label: "ÇORBA ÇEŞİTLERİ" },
    { id: "İÇECEK", label: "İÇECEKLER" },
    { id: "EKSTRA", label: "EKSTRA FARKLAR" }
];

export default function AdminMenuAdd() {
    const { menu, loading, refetch } = useMenu();
    const insets = useSafeAreaInsets();

    const [mainTab, setMainTab] = useState<"TABILDOT" | "TEKIL">("TABILDOT");
    const [sendNotification, setSendNotification] = useState(true);

    // Günün Menüsü State
    const [dailyMenu, setDailyMenu] = useState({
        soup: "", soupAlt: "",
        main: "", mainAlt: "",
        side: "", sideAlt: "",
        dessert: "", dessertAlt: "",
    });

    // Yayında Olan Menü (Günün Menüsü)
    const [publishedMenu, setPublishedMenu] = useState<{
        soup: string, soupAlt?: string,
        main: string, mainAlt?: string,
        side: string, sideAlt?: string,
        dessert: string, dessertAlt?: string,
        date: string
    } | null>(null);

    React.useEffect(() => {
        // Formu yayındaki menü ile doldur
        if (publishedMenu) {
            setDailyMenu({
                soup: publishedMenu.soup || "",
                soupAlt: publishedMenu.soupAlt || "",
                main: publishedMenu.main || "",
                mainAlt: publishedMenu.mainAlt || "",
                side: publishedMenu.side || "",
                sideAlt: publishedMenu.sideAlt || "",
                dessert: publishedMenu.dessert || "",
                dessertAlt: publishedMenu.dessertAlt || "",
            });
        } else {
            setDailyMenu({
                soup: "", soupAlt: "",
                main: "", mainAlt: "",
                side: "", sideAlt: "",
                dessert: "", dessertAlt: "",
            });
        }
    }, [publishedMenu]);

    const [defaultPrices, setDefaultPrices] = useState<Record<string, string>>({});

    useFocusEffect(
        React.useCallback(() => {
            refetch();
            AsyncStorage.getItem("unit_prices").then(res => {
                if (res) setDefaultPrices(JSON.parse(res));
            });
        }, [])
    );

    // Tek Çeşit (Liste) State
    const [newItem, setNewItem] = useState({
        name: "",
        category: "ANA YEMEK",
        price: "180",
        image_url: "",
        image_base64: "",
    });

    const handleCategorySelect = (categoryId: string) => {
        let defaultPrice = "";

        switch (categoryId) {
            case "ÇORBA": defaultPrice = defaultPrices.CORBA || "135"; break;
            case "ANA YEMEK": defaultPrice = defaultPrices.ANAYEMEK || "180"; break;
            case "YARDIMCI": defaultPrice = defaultPrices.YARDIMCI || "90"; break;
            case "İÇECEK": defaultPrice = defaultPrices.ICECEKLER || "40"; break;
        }

        setNewItem(prev => ({ ...prev, category: categoryId, price: defaultPrice }));
    };

    const handlePublishDailyMenu = () => {
        if (!dailyMenu.main) {
            Alert.alert("Uyarı", "Günün menüsü için en azından ana yemeği girmelisiniz.");
            return;
        }

        setPublishedMenu({
            ...dailyMenu,
            date: new Date().toLocaleDateString('tr-TR')
        });

        Alert.alert("Başarılı", `Günün menüsü başarıyla yayınlandı!`);

        if (sendNotification) {
            // Bildirim gönderme lojiği
        }
    };

    const handleClearDailyMenu = () => {
        Alert.alert("Emin misiniz?", `Günün menüsünü yayından kaldırmak istiyor musunuz?`, [
            { text: "İptal", style: "cancel" },
            {
                text: "Kaldır", style: "destructive", onPress: () => {
                    setPublishedMenu(null);
                }
            }
        ]);
    };


    const handleAddIndividual = async () => {
        if (!newItem.name || !newItem.price) {
            Alert.alert("Uyarı", "Lütfen isim ve fiyat giriniz.");
            return;
        }

        try {
            await menuService.addMenuItem(newItem.name, newItem.category, Number(newItem.price), newItem.image_url, newItem.image_base64);
            Alert.alert("Başarılı", `${newItem.name} listeye eklendi.`);
            setNewItem({ name: "", category: newItem.category, price: "", image_url: "", image_base64: "" }); // kategoriyi sıfırlama
            refetch(); // Refresh the list
        } catch (error: any) {
            Alert.alert("Hata", "Yemek eklenirken bir sorun oluştu: " + error.message);
        }
    };

    const handlePickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        Alert.alert("Emin misiniz?", "Bu öğeyi listeden kaldırmak istiyor musunuz?", [
            { text: "İptal", style: "cancel" },
            {
                text: "Sil", style: "destructive", onPress: async () => {
                    try {
                        await menuService.deleteMenuItem(id);
                        refetch(); // Refresh the list
                    } catch (error: any) {
                        Alert.alert("Hata", "Silme işlemi başarısız: " + error.message);
                    }
                }
            }
        ])
    };

    const combinedMenu = menu || [];

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: "#f8fafc" }]}>
                <ActivityIndicator size="large" color="#74CF62" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Menü Yönetimi</Text>
                    <Text style={styles.subtitle}>SİSTEM İÇERİĞİNİ GÜNCELLE</Text>
                </View>
                <TouchableOpacity
                    style={styles.unitPriceButton}
                    onPress={() => router.push("/(admin)/unit-price")}
                >
                    <MaterialIcons name="payments" size={24} color="#74CF62" />
                </TouchableOpacity>
            </View>

            <View style={styles.tabToggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, mainTab === "TABILDOT" && styles.activeToggleBtn]}
                    onPress={() => setMainTab("TABILDOT")}
                >
                    <Text style={[styles.toggleBtnText, mainTab === "TABILDOT" && styles.activeToggleBtnText]}>
                        GÜNÜN MENÜSÜ
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, mainTab === "TEKIL" && styles.activeToggleBtn]}
                    onPress={() => setMainTab("TEKIL")}
                >
                    <Text style={[styles.toggleBtnText, mainTab === "TEKIL" && styles.activeToggleBtnText]}>
                        SABİT LİSTE
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {mainTab === "TABILDOT" ? (
                    <View>
                        {/* Yayında Olan Menü Gösterimi */}
                        {publishedMenu && (
                            <View style={styles.publishedCard}>
                                <View style={[styles.publishedHeader, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <MaterialIcons name="assignment-turned-in" size={20} color="#74CF62" />
                                        <Text style={[styles.publishedTitle, { flexShrink: 1 }]} numberOfLines={1}>YAYINDA OLAN GÜNÜN MENÜSÜ</Text>
                                    </View>
                                    <Text style={[styles.publishedDate, { marginLeft: 26 }]}>{publishedMenu.date}</Text>
                                </View>
                                <View style={[styles.publishedContent, { flexWrap: 'wrap', flexDirection: 'row', gap: 12 }]}>
                                    {(publishedMenu.soup || publishedMenu.soupAlt) && (
                                        <View style={styles.dailyCategoryGroup}>
                                            <Text style={styles.dailyCategoryHeader}>ÇORBALAR</Text>
                                            {publishedMenu.soup && <Text style={styles.publishedItem}>• {publishedMenu.soup}</Text>}
                                            {publishedMenu.soupAlt && <Text style={styles.publishedItem}>• {publishedMenu.soupAlt}</Text>}
                                        </View>
                                    )}
                                    {(publishedMenu.main || publishedMenu.mainAlt) && (
                                        <View style={styles.dailyCategoryGroup}>
                                            <Text style={styles.dailyCategoryHeader}>ANA YEMEKLER</Text>
                                            {publishedMenu.main && <Text style={styles.publishedItem}>• {publishedMenu.main}</Text>}
                                            {publishedMenu.mainAlt && <Text style={styles.publishedItem}>• {publishedMenu.mainAlt}</Text>}
                                        </View>
                                    )}
                                    {(publishedMenu.side || publishedMenu.sideAlt) && (
                                        <View style={styles.dailyCategoryGroup}>
                                            <Text style={styles.dailyCategoryHeader}>YARDIMCI YEMEKLER</Text>
                                            {publishedMenu.side && <Text style={styles.publishedItem}>• {publishedMenu.side}</Text>}
                                            {publishedMenu.sideAlt && <Text style={styles.publishedItem}>• {publishedMenu.sideAlt}</Text>}
                                        </View>
                                    )}
                                    {(publishedMenu.dessert || publishedMenu.dessertAlt) && (
                                        <View style={styles.dailyCategoryGroup}>
                                            <Text style={styles.dailyCategoryHeader}>TATLI / İÇECEKLER</Text>
                                            {publishedMenu.dessert && <Text style={styles.publishedItem}>• {publishedMenu.dessert}</Text>}
                                            {publishedMenu.dessertAlt && <Text style={styles.publishedItem}>• {publishedMenu.dessertAlt}</Text>}
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity style={styles.clearMenuBtn} onPress={() => handleClearDailyMenu()}>
                                    <MaterialIcons name="cancel" size={16} color="#ef4444" />
                                    <Text style={styles.clearMenuBtnText}>Yayından Kaldır</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.formContainer}>
                            <Text style={styles.sectionHeader}>GÜNÜN MENÜSÜNÜ {publishedMenu ? "GÜNCELLE" : "OLUŞTUR"}</Text>

                            <InputField
                                label="ÇORBA (Seçenek 1)"
                                icon="soup-kitchen"
                                value={dailyMenu.soup}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, soup: t })}
                            />
                            <InputField
                                label="ÇORBA (Seçenek 2 - Opsiyonel)"
                                icon="soup-kitchen"
                                value={dailyMenu.soupAlt}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, soupAlt: t })}
                            />

                            <InputField
                                label="ANA YEMEK (Seçenek 1) *"
                                icon="restaurant"
                                value={dailyMenu.main}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, main: t })}
                            />
                            <InputField
                                label="ANA YEMEK (Seçenek 2 - Opsiyonel)"
                                icon="restaurant"
                                value={dailyMenu.mainAlt}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, mainAlt: t })}
                            />

                            <InputField
                                label="YARDIMCI YEMEK (Seçenek 1)"
                                icon="flatware"
                                value={dailyMenu.side}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, side: t })}
                            />
                            <InputField
                                label="YARDIMCI YEMEK (Seçenek 2 - Opsiyonel)"
                                icon="flatware"
                                value={dailyMenu.sideAlt}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, sideAlt: t })}
                            />

                            <InputField
                                label="TATLI / İÇECEK (Seçenek 1)"
                                icon="cake"
                                value={dailyMenu.dessert}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, dessert: t })}
                            />
                            <InputField
                                label="TATLI / İÇECEK (Seçenek 2 - Opsiyonel)"
                                icon="cake"
                                value={dailyMenu.dessertAlt}
                                onChangeText={(t) => setDailyMenu({ ...dailyMenu, dessertAlt: t })}
                            />

                            <TouchableOpacity
                                style={styles.notifyContainer}
                                onPress={() => setSendNotification(!sendNotification)}
                                activeOpacity={0.8}
                            >
                                <MaterialIcons
                                    name={sendNotification ? "check-box" : "check-box-outline-blank"}
                                    size={24}
                                    color={sendNotification ? "#74CF62" : "#cbd5e1"}
                                />
                                <Text style={styles.notifyText}>
                                    Menüyü yayınla ve müşterilere bildirim gönder
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.publishBtn} onPress={handlePublishDailyMenu}>
                                <MaterialIcons name={publishedMenu ? "update" : "send"} size={20} color="#fff" />
                                <Text style={styles.publishBtnText}>
                                    {publishedMenu ? "MENÜYÜ GÜNCELLE" : "MÜŞTERİLERE YAYINLA"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoBox}>
                            <MaterialIcons name="info" size={20} color="#3b82f6" />
                            <Text style={styles.infoText}>Müşteriler bu menü içerisinden diledikleri gibi 4 Çeşit, 3 Çeşit veya 2 Çeşit seçim yapabilecektir.</Text>
                        </View>
                    </View>
                ) : (
                    <View>
                        <View style={styles.formContainer}>
                            <Text style={styles.sectionHeader}>SABİT LİSTEYE YENİ ÖĞE EKLE</Text>

                            <InputField
                                label="ÖĞE ADI"
                                icon="edit"
                                value={newItem.name}
                                onChangeText={(t) => setNewItem({ ...newItem, name: t })}
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
                                            <Text style={[styles.catText, newItem.category === cat.id && styles.activeCatText]}>
                                                {cat.label}
                                            </Text>
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
                                            <MaterialIcons name="add-a-photo" size={24} color="#94a3b8" />
                                            <Text style={styles.imagePickerText}>Fotoğraf Seç</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                {newItem.image_url ? (
                                    <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setNewItem({ ...newItem, image_url: "" })}>
                                        <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>Fotoğrafı Kaldır</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <InputField
                                label="BİRİM FİYAT (₺)"
                                icon="payments"
                                keyboardType="numeric"
                                value={newItem.price}
                                onChangeText={(t) => setNewItem({ ...newItem, price: t })}
                            />

                            <TouchableOpacity style={styles.addBtn} onPress={handleAddIndividual}>
                                <Text style={styles.addBtnText}>SİSTEME KAYDET</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.listContainer}>
                            <Text style={styles.sectionHeader}>SABİT MEYDAN LİSTESİ ({combinedMenu.length})</Text>

                            {CATEGORIES.map(cat => {
                                const items = combinedMenu.filter((item: any) => item.category === cat.id);
                                if (items.length === 0) return null;
                                return (
                                    <View key={cat.id} style={{ marginBottom: 24 }}>
                                        <View style={styles.categoryTitleBox}>
                                            <Text style={styles.categoryTitleText}>{cat.label}</Text>
                                            <View style={styles.categoryTitleLine} />
                                        </View>
                                        {items.map((item: any) => (
                                            <View key={item.id} style={styles.menuItemCard}>
                                                <View style={styles.menuItemContent}>
                                                    <View style={[styles.menuItemImagePlaceholder, { backgroundColor: '#f0fdf4', overflow: 'hidden' }]}>
                                                        {item.image_url ? (
                                                            <Image
                                                                source={{ uri: item.image_url }}
                                                                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <MaterialIcons name={
                                                                item.category === "İÇECEK" ? "local-drink" :
                                                                    item.category === "ÇORBA" ? "soup-kitchen" :
                                                                        item.category === "EKSTRA" ? "add-circle-outline" : "restaurant"
                                                            } size={28} color="#16a34a" />
                                                        )}
                                                    </View>
                                                    <View style={styles.menuItemTextCont}>
                                                        <Text style={styles.menuItemName}>{item.name}</Text>
                                                        <Text style={styles.menuItemDetails}>
                                                            ₺{item.price}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.deleteBtn}
                                                    onPress={() => handleDeleteItem(item.id)}
                                                >
                                                    <MaterialIcons name="delete" size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}

                            {combinedMenu.length === 0 && (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <MaterialIcons name="fastfood" size={48} color="#cbd5e1" />
                                    <Text style={{ marginTop: 10, color: '#94a3b8', fontWeight: 'bold' }}>Henüz kayıtlı öğe yok</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const InputField = ({ label, icon, value, onChangeText, keyboardType = "default" }: { label: string, icon: any, value: string, onChangeText: (t: string) => void, keyboardType?: any }) => (
    <View style={styles.inputWrapper}>
        <View style={styles.inputIconRow}>
            <MaterialIcons name={icon} size={16} color="#94a3b8" />
            <Text style={styles.inputLabel}>{label}</Text>
        </View>
        <TextInput
            style={styles.input}
            placeholder="Giriş yapınız..."
            placeholderTextColor="#cbd5e1"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
        />
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    title: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
    subtitle: {
        fontSize: 10,
        fontWeight: "900",
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginTop: 4,
    },
    unitPriceButton: {
        width: 44,
        height: 44,
        backgroundColor: "#fff",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    tabToggleContainer: {
        flexDirection: "row",
        backgroundColor: "#e2e8f0",
        padding: 6,
        borderRadius: 20,
        marginHorizontal: 24,
        marginBottom: 20,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    activeToggleBtn: {
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    toggleBtnText: {
        fontSize: 10,
        fontWeight: "900",
        color: "#64748b",
        letterSpacing: 1,
    },
    activeToggleBtnText: {
        color: "#74CF62",
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    tabildotTabs: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 24,
    },
    tabildotTab: {
        flex: 1,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 16,
        alignItems: "center",
    },
    activeTabildotTab: {
        backgroundColor: "#74CF62",
        borderColor: "#74CF62",
    },
    tabildotTabText: {
        fontSize: 11,
        fontWeight: "900",
        color: "#64748b",
    },
    activeTabildotTabText: {
        color: "#fff",
    },
    publishedCard: {
        backgroundColor: "#f0fdf4",
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#bbf7d0",
    },
    publishedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#dcfce7',
        paddingBottom: 12
    },
    publishedTitle: {
        fontSize: 12,
        fontWeight: "900",
        color: "#16a34a",
        letterSpacing: 1,
    },
    publishedDate: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#16a34a",
    },
    publishedContent: {
        gap: 8,
    },
    publishedItem: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#0f172a",
    },
    clearMenuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
        paddingVertical: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    clearMenuBtnText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    formContainer: {
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: "#f1f5f9",
    },
    inputWrapper: {
        marginBottom: 20,
    },
    inputIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
        marginLeft: 4,
    },
    inputLabel: {
        fontSize: 9,
        fontWeight: "900",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 1.5,
    },
    input: {
        backgroundColor: "#f8fafc",
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 14,
        fontWeight: "bold",
        color: "#0f172a",
    },
    notifyContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        marginBottom: 16,
    },
    notifyText: {
        flex: 1,
        fontSize: 12,
        fontWeight: "bold",
        color: "#64748b",
    },
    publishBtn: {
        backgroundColor: "#0f172a",
        paddingVertical: 20,
        borderRadius: 24,
        alignItems: "center",
    },
    publishBtnText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: '#1e3a8a',
        lineHeight: 18,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "900",
        color: "#94a3b8",
        letterSpacing: 1.5,
        marginBottom: 20,
    },
    categoryContainer: {
        marginBottom: 20,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8
    },
    catBtn: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    activeCatBtn: {
        backgroundColor: '#74CF62',
        borderColor: '#74CF62'
    },
    catText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b'
    },
    activeCatText: {
        color: '#fff'
    },
    addBtn: {
        backgroundColor: "#10b981",
        paddingVertical: 20,
        borderRadius: 24,
        alignItems: "center",
        marginTop: 8,
    },
    addBtnText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1,
    },
    listContainer: {
        marginTop: 32,
    },
    menuItemCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#f1f5f9",
        marginBottom: 12,
    },
    menuItemContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        flex: 1,
    },
    menuItemImagePlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    menuItemTextCont: {
        flex: 1,
    },
    menuItemName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f172a",
        marginBottom: 4,
    },
    menuItemDetails: {
        fontSize: 10,
        fontWeight: "900",
        color: "#74CF62",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    deleteBtn: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: "#fef2f2",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: '#fecaca'
    },
    imagePickerContainer: {
        marginBottom: 20,
    },
    imagePickerBtn: {
        height: 120,
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#cbd5e1",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
        overflow: "hidden"
    },
    imagePickerText: {
        marginTop: 8,
        color: "#64748b",
        fontSize: 14,
        fontWeight: "500"
    },
    previewImage: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
    },
    dailyCategoryGroup: {
        marginBottom: 12,
        minWidth: "45%",
    },
    dailyCategoryHeader: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#64748b",
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    categoryTitleBox: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        gap: 12,
    },
    categoryTitleText: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#475569",
        letterSpacing: 1,
    },
    categoryTitleLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#e2e8f0",
    }
});
