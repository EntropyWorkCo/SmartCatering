// Cache buster: forcing file re-evaluation
import Colors from "@/constants/Colors";
import { useCartStore } from "@/lib/store/cartStore";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useNavigation } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    RefreshControl
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/hooks/useAuth";
import { useMenu } from "../../lib/hooks/useMenu";
import { useProfile } from "../../lib/hooks/useProfile";

export default function MenuScreen() {
  const { menu, systemPrices, loading, refetch: refetchMenu } = useMenu(true);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cartItems = useCartStore(state => state.items);
  const orderMode = useCartStore(state => state.orderMode);

  const { user } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile(user?.id);

  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const activeCategories = ["GÜNÜN MENÜSÜ", "TABLDOT", "TEK ÇEŞİTLER", "İÇECEKLER", "EKSTRALAR"];

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [user?.id])
  );
  const isCompany = profile?.is_company || false;

  const TABLDOT_PACKAGES = systemPrices
    .filter(p => p.category === "TABLDOT")
    .map(pkg => {
      let maxItems = 4;
      let desc = "Seçeceğiniz 4 çeşit yemek (Örn: Çorba, Ana Yemek, 2 Yardımcı)";
      if (pkg.name.includes("3") || pkg.name.includes("3 ÇEŞİT")) {
        maxItems = 3;
        desc = "Seçeceğiniz 3 çeşit yemek (Örn: Çorba, Ana Yemek, Yardımcı)";
      } else if (pkg.name.includes("2") || pkg.name.includes("2 ÇEŞİT")) {
        maxItems = 2;
        desc = "Seçeceğiniz 2 çeşit yemek (Örn: Çorba, Ana Yemek)";
      }
      return { id: pkg.id, name: pkg.name, price: pkg.price, category: "PAKET", maxItems, desc };
    })
    .sort((a, b) => b.price - a.price);

  const [packageModalVisible, setPackageModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [packageSelections, setPackageSelections] = useState<{ category: string, item_id: string, item_name: string }[]>([]);

  // Tek Çeşit / Ekstra detay modalı
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailContext, setDetailContext] = useState<any[]>([]); // o kategorideki diğer günlük öğeler

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refresh === 'function') refresh(); // Profile
      if (refetchMenu) await refetchMenu();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refetchMenu]);

  // Dışarıdan gelen yönlendirmelerde (Örn: Ana sayfa tabldot) otomatik kategoriyi açmak için
  React.useEffect(() => {
    if (orderMode === 'eat_now') {
      setSelectedCategory("GÜNÜN MENÜSÜ");
    } else if (orderMode === 'pre_order') {
      setSelectedCategory("TABLDOT");
    }
  }, []);

  // Günün Menüsü (aktif/draft/sold_out — İÇECEK hariç tümü)
  const dailyMenu = menu;

  // DB'deki gerçek kategori adları (web admin paneli ile aynı)
  const DAILY_FOOD_CATEGORIES = ["ÇORBA ÇEŞİTLERİ", "ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"];
  const CAT_LABELS: Record<string, string> = {
    "ÇORBA ÇEŞİTLERİ": "Çorba Çeşitleri",
    "ANA YEMEK": "Ana Yemek",
    "YARDIMCI": "Yardımcı Yemek",
    "TAMAMLAYICI": "Tamamlayıcı",
    "EKSTRA": "Sabit Ekstralar",
    "İÇECEK": "İçecekler",
    "TEK ÇEŞİT": "Tek Çeşit Fiyatları",
  };
  const CAT_ORDER = ["ÇORBA ÇEŞİTLERİ", "ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"];

  // TEK ÇEŞİTLER için: günlük menü öğeleri (kategori bazlı gösterim)
  const tekCesitDailyItems = dailyMenu.filter(m => DAILY_FOOD_CATEGORIES.includes(m.category));
  const tekCesitSystemPrices = systemPrices.filter(p => p.category === "TEK ÇEŞİT");

  // EKSTRALAR için: günlük menüden ANA YEMEK/YARDIMCI/TAMAMLAYICI + sistem ekstraları
  const ekstraGunlukItems = dailyMenu.filter(m => ["ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"].includes(m.category));
  const ekstraSystemItems = systemPrices.filter(p => p.category === "EKSTRA");

  let filteredMenu: any[] = [];
  if (selectedCategory === "İÇECEKLER") {
    filteredMenu = [
      // DB'de kategori "İÇECEKLER" (S'li) — web admin paneli bu şekilde kaydediyor
      ...menu.filter(m => m.category === "İÇECEKLER" || m.category === "İÇECEK"),
      ...systemPrices.filter(p => p.category === "İÇECEKLER" || p.category === "İÇECEK")
    ];
  }

  // Detay modalı açma yardımcısı
  const openDetailModal = (item: any) => {
    // Aynı kategorideki diğer günlük öğeleri bul (bağlam için)
    const siblings = dailyMenu.filter(m => m.category === item.category && m.id !== item.id);
    setDetailItem(item);
    setDetailContext(siblings);
    setDetailModalVisible(true);
  };

  const handleAddToCart = (item: any) => {
    if (!orderMode) {
      Alert.alert(
        "Seçim Gerekli",
        "Menüden ürün ekleyebilmek için lütfen önce Ana Sayfadan 'Şimdi Ye' veya 'Sipariş Ver' seçeneğini işaretleyin.",
        [{ text: "Tamam" }]
      );
      return;
    }

    if ((item.category === "PAKET" || item.category === "TABLDOT") && orderMode === 'pre_order') {
      setSelectedPackage(item);
      setPackageSelections([]); // reset
      setPackageModalVisible(true);
      return;
    }

    useCartStore.getState().addItem({
      menu_item_id: item.id,
      name: (item.category === "PAKET" || item.category === "TABLDOT") && item.maxItems ? `${item.maxItems}'LÜ TABLDOT` : item.name,
      price: item.price,
      quantity: 1,
      is_package: item.category === "PAKET" || item.category === "TABLDOT",
    });
  };

  const handleDecrement = (id: string) => {
    useCartStore.getState().decrementItem(id);
  };

  const getCartQuantity = (id: string) => cartItems.find(i => i.menu_item_id === id)?.quantity || 0;

  const handleConfirmPackage = () => {
    if (!selectedPackage) return;
    
    // Check if the total number of items selected matches the package requirement
    // togglePackageSelection already ensures that each selection is from a unique category
    if (packageSelections.length !== selectedPackage.maxItems) {
      Alert.alert("Eksik/Fazla Seçim", `Lütfen her gruptan birer tane olmak şartıyla tam ${selectedPackage.maxItems} çeşit yemek seçiniz.`);
      return;
    }

    useCartStore.getState().addItem({
      menu_item_id: selectedPackage.id,
      name: selectedPackage?.maxItems ? `${selectedPackage.maxItems}'LÜ TABLDOT` : selectedPackage.name,
      price: selectedPackage.price,
      quantity: 1,
      is_package: true,
      selections: packageSelections
    });

    Alert.alert("Paket Eklendi", `${selectedPackage.name} sepete eklendi.`);
    setPackageModalVisible(false);
    setSelectedPackage(null);
    setPackageSelections([]);
  };

  const togglePackageSelection = (meal: any) => {
    const isSelected = packageSelections.find(s => s.item_id === meal.id);
    if (isSelected) {
      setPackageSelections(prev => prev.filter(s => s.item_id !== meal.id));
    } else {
      // Her çeşitten birer tane kuralı - aynı kategoriden varsa değiştir
      setPackageSelections(prev => {
        const filtered = prev.filter(s => s.category !== meal.category);
        return [...filtered, { category: meal.category, item_id: meal.id, item_name: meal.name }];
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleChangeMode = () => {
    if (cartItems.length > 0) {
      Alert.alert("Mod Değiştir", "Modu değiştirmek sepetinizi sıfırlayacaktır. Devam edilsin mi?", [
        { text: "Vazgeç" },
        { text: "Evet, Değiştir", style: "destructive", onPress: () => {
           useCartStore.getState().clearCart();
           const nextMode = orderMode === 'eat_now' ? 'pre_order' : 'eat_now';
           useCartStore.getState().setOrderMode(nextMode);
           setSelectedCategory(null);
        }}
      ]);
    } else {
      const nextMode = orderMode === 'eat_now' ? 'pre_order' : 'eat_now';
      useCartStore.getState().setOrderMode(nextMode);
      setSelectedCategory(null);
    }
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => {
            if (selectedCategory !== null) {
              setSelectedCategory(null);
            } else if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              router.push("/(tabs)/home");
            }
          }} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Menü</Text>
            <Text style={styles.subtitle}>{selectedCategory ? selectedCategory : "KATEGORİ SEÇİNİZ"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={styles.cartButton} onPress={() => {
            if (totalCartCount > 0) router.push("/(tabs)/cart");
            else Alert.alert("Sepet Boş", "Sepetinizde henüz ürün bulunmuyor.");
          }}>
            <MaterialIcons name="shopping-cart" size={24} color={colors.primary} />
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {orderMode && (
        <View style={{ 
          backgroundColor: orderMode === 'eat_now' ? '#fffbeb' : '#ecfdf5', 
          paddingVertical: 10, paddingHorizontal: 20, 
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderBottomWidth: 1, borderBottomColor: orderMode === 'eat_now' ? '#fde68a' : '#a7f3d0'
        }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: orderMode === 'eat_now' ? '#d97706' : '#059669' }}>
            {orderMode === 'eat_now' ? '🍽️ MOD: ŞİMDİ YE' : '📅 MOD: SİPARİŞ VER'}
          </Text>
          <TouchableOpacity 
            onPress={handleChangeMode}
            style={{ 
              backgroundColor: '#fff', 
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
              borderWidth: 1, borderColor: orderMode === 'eat_now' ? '#fde68a' : '#a7f3d0',
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: orderMode === 'eat_now' ? '#d97706' : '#059669' }}>DEĞİŞTİR</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedCategory === null ? (
        <ScrollView 
          contentContainerStyle={{ padding: 24, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} title="Yenileniyor..." titleColor={colors.text} colors={[colors.primary]} progressBackgroundColor="#ffffff" progressViewOffset={30} />}
        >
          {activeCategories.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
              onPress={() => setSelectedCategory(cat)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                 <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardHighlight, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={
                          cat === "GÜNÜN MENÜSÜ" ? "restaurant-menu" :
                          cat === "TABLDOT" ? "breakfast-dining" :
                          cat === "TEK ÇEŞİTLER" ? "lunch-dining" :
                          cat === "İÇECEKLER" ? "local-drink" : "add-circle-outline"
                      } size={20} color={colors.primary} />
                 </View>
                 <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{cat}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: cartItems.length > 0 ? 120 : 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} title="Yenileniyor..." titleColor={colors.text} colors={[colors.primary]} progressBackgroundColor="#ffffff" progressViewOffset={30} />}
        >
           {/* Dinamik Olarak Kategori Barını Gizlediğimiz İçin Burada Kaldırdık */}

        {/* Günün Menüsü (Always at top or dedicated tab) */}
        {((selectedCategory === "TÜMÜ" || selectedCategory === "GÜNÜN MENÜSÜ") && dailyMenu.length > 0) && (
          <View style={{ paddingTop: 24, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 }}>Günün Menüsü</Text>

            {Array.from(new Set(dailyMenu.map(m => m.category)))
              .filter(cat => cat !== "İÇECEKLER" && cat !== "İÇECEK")
              .sort((a, b) => {
                const order = ["ÇORBA ÇEŞİTLERİ", "ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"];
                const indexA = order.indexOf(a);
                const indexB = order.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              })
              .map(catKey => {
              const catItems = dailyMenu.filter(item => item.category === catKey);
              if (catItems.length === 0) return null;

              const catLabels: Record<string, string> = {
                "ÇORBA ÇEŞİTLERİ": "Çorbalar",
                "ANA YEMEK": "Ana Yemekler",
                "YARDIMCI": "Yardımcı Yemekler",
                "TAMAMLAYICI": "Tamamlayıcılar"
              };

              return (
                <View key={catKey} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {catLabels[catKey] || catKey}
                  </Text>
                  <View style={{ gap: 16 }}>
                    {catItems.map(item => (
                      <View key={item.id} style={[styles.foodCard, item.status === 'sold_out' && { opacity: 0.6 }]}>
                        <View style={styles.foodImageContainer}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.foodImage} />
                          ) : (
                            <MaterialIcons name={
                              item.category === "İÇECEKLER" || item.category === "İÇECEK" ? "local-drink" :
                                item.category === "ÇORBA ÇEŞİTLERİ" || item.category === "ÇORBA" ? "soup-kitchen" :
                                  item.category === "EKSTRA FARKLAR" || item.category === "EKSTRA" ? "add-circle-outline" :
                                    "restaurant"
                            } size={40} color={colors.muted} />
                          )}
                        </View>
                        <View style={styles.foodDetails}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                          </View>
                          <View style={styles.foodBottomColumn}>
                            {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                            {item.status === 'sold_out' ? (
                              <View style={{ backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>TÜKENDİ</Text>
                              </View>
                            ) : (
                              getCartQuantity(item.id) > 0 ? (
                                <View style={[styles.activeQuantityContainer, { marginTop: 8 }]}>
                                  <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                                    <MaterialIcons name="remove" size={16} color="#fff" />
                                  </TouchableOpacity>
                                  <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                                  <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.activeQtyBtn}>
                                    <MaterialIcons name="add" size={16} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity style={[styles.addBtnLarge, { marginTop: 8 }]} onPress={() => handleAddToCart(item)}>
                                  <MaterialIcons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>EKLE</Text>
                                </TouchableOpacity>
                              )
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── TEK ÇEŞİTLER ── Günlük menü öğeleri kategori bazlı + sistem fiyatları */}
        {selectedCategory === "TEK ÇEŞİTLER" && (
          <View style={styles.listContainer}>
            {tekCesitDailyItems.length === 0 && tekCesitSystemPrices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="fastfood" size={48} color={colors.surfaceBorder} />
                <Text style={styles.emptyText}>Bugün menü henüz yayınlanmadı</Text>
              </View>
            ) : (
              <>
                {/* Günlük menü — kategori grupları */}
                {tekCesitDailyItems.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>Bugünün Menüsü</Text>
                    {CAT_ORDER
                      .filter(cat => tekCesitDailyItems.some(m => m.category === cat))
                      .map(cat => {
                        const catItems = tekCesitDailyItems.filter(m => m.category === cat);
                        return (
                          <View key={cat} style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                              {CAT_LABELS[cat] || cat}
                            </Text>
                            <View style={{ gap: 10 }}>
                              {catItems.map(item => (
                                <TouchableOpacity
                                  key={item.id}
                                  style={[styles.foodCard, item.status === 'sold_out' && { opacity: 0.6 }]}
                                  onPress={() => openDetailModal(item)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.foodImageContainer}>
                                    {item.image_url ? (
                                      <Image source={{ uri: item.image_url }} style={styles.foodImage} />
                                    ) : (
                                      <MaterialIcons name={cat === 'ÇORBA ÇEŞİTLERİ' ? 'soup-kitchen' : 'restaurant'} size={36} color={colors.muted} />
                                    )}
                                  </View>
                                  <View style={styles.foodDetails}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                      <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                                      {item.status === 'sold_out' && (
                                        <Text style={{ fontSize: 10, color: colors.danger, fontWeight: 'bold', marginTop: 2 }}>TÜKENDİ</Text>
                                      )}
                                    </View>
                                    <View style={styles.foodBottomColumn}>
                                      {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        {getCartQuantity(item.id) > 0 ? (
                                          <View style={[styles.activeQuantityContainer, { marginTop: 0 }]}>
                                            <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                                              <MaterialIcons name="remove" size={14} color="#fff" />
                                            </TouchableOpacity>
                                            <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                                            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleAddToCart(item); }} style={styles.activeQtyBtn}>
                                              <MaterialIcons name="add" size={14} color="#fff" />
                                            </TouchableOpacity>
                                          </View>
                                        ) : (
                                          item.status !== 'sold_out' && (
                                            <TouchableOpacity
                                              style={[styles.addBtnLarge, { marginTop: 0 }]}
                                              onPress={(e) => { e.stopPropagation?.(); handleAddToCart(item); }}
                                            >
                                              <MaterialIcons name="add" size={14} color="#fff" />
                                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>EKLE</Text>
                                            </TouchableOpacity>
                                          )
                                        )}
                                      </View>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })
                    }
                  </>
                )}

                {/* Sistem fiyat listesi — Tek Çeşit sabit fiyatlar */}
                {tekCesitSystemPrices.length > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 20 }} />
                    <Text style={{ fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Tek Çeşit Fiyat Listesi</Text>
                    {tekCesitSystemPrices.map(item => (
                      <View key={item.id} style={[styles.foodCard, { marginBottom: 10 }]}>
                        <View style={styles.foodImageContainer}>
                          <MaterialIcons name="lunch-dining" size={36} color={colors.muted} />
                        </View>
                        <View style={styles.foodDetails}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.foodName}>{item.name}</Text>
                            <Text style={styles.foodCategory}>Sabit Fiyat</Text>
                          </View>
                          <View style={styles.foodBottomColumn}>
                            {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                            {getCartQuantity(item.id) > 0 ? (
                              <View style={[styles.activeQuantityContainer, { marginTop: 8 }]}>
                                <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                                  <MaterialIcons name="remove" size={14} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                                <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.activeQtyBtn}>
                                  <MaterialIcons name="add" size={14} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity style={[styles.addBtnLarge, { marginTop: 8 }]} onPress={() => handleAddToCart(item)}>
                                <MaterialIcons name="add" size={14} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>EKLE</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ── İÇECEKLER ── */}
        {selectedCategory === "İÇECEKLER" && (
          <View style={styles.listContainer}>
            {filteredMenu.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="local-drink" size={48} color={colors.surfaceBorder} />
                <Text style={styles.emptyText}>Bu kategoride aktif ürün yok</Text>
              </View>
            ) : (
              filteredMenu.map(item => (
                <View key={item.id} style={[styles.foodCard, item.status === 'sold_out' && { opacity: 0.6 }]}>
                  <View style={styles.foodImageContainer}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.foodImage} />
                    ) : (
                      <MaterialIcons name="local-drink" size={40} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.foodDetails}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.foodCategory}>İçecek</Text>
                    </View>
                    <View style={styles.foodBottomColumn}>
                      {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                      {item.status === 'sold_out' ? (
                        <View style={{ backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>TÜKENDİ</Text>
                        </View>
                      ) : (
                        getCartQuantity(item.id) > 0 ? (
                          <View style={[styles.activeQuantityContainer, { marginTop: 8 }]}>
                            <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                              <MaterialIcons name="remove" size={16} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                            <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.activeQtyBtn}>
                              <MaterialIcons name="add" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={[styles.addBtnLarge, { marginTop: 8 }]} onPress={() => handleAddToCart(item)}>
                            <MaterialIcons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>EKLE</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── EKSTRALAR ── Günlük menü öğeleri kategori gruplu + sistem ekstraları */}
        {selectedCategory === "EKSTRALAR" && (
          <View style={styles.listContainer}>
            {ekstraGunlukItems.length === 0 && ekstraSystemItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="add-circle-outline" size={48} color={colors.surfaceBorder} />
                <Text style={styles.emptyText}>Bu kategoride aktif ürün yok</Text>
              </View>
            ) : (
              <>
                {/* Günlük menüden gelen yemekler — kategori gruplu */}
                {ekstraGunlukItems.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>Bugünün Menüsünden Ekle</Text>
                    {["ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"]
                      .filter(cat => ekstraGunlukItems.some(m => m.category === cat))
                      .map(cat => {
                        const catItems = ekstraGunlukItems.filter(m => m.category === cat);
                        return (
                          <View key={cat} style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                              {CAT_LABELS[cat] || cat}
                            </Text>
                            <View style={{ gap: 10 }}>
                              {catItems.map(item => (
                                <TouchableOpacity
                                  key={item.id}
                                  style={[styles.foodCard, item.status === 'sold_out' && { opacity: 0.6 }]}
                                  onPress={() => openDetailModal(item)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.foodImageContainer}>
                                    {item.image_url ? (
                                      <Image source={{ uri: item.image_url }} style={styles.foodImage} />
                                    ) : (
                                      <MaterialIcons name="restaurant" size={36} color={colors.muted} />
                                    )}
                                  </View>
                                  <View style={styles.foodDetails}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                      <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                                      {item.status === 'sold_out' && (
                                        <Text style={{ fontSize: 10, color: colors.danger, fontWeight: 'bold', marginTop: 2 }}>TÜKENDİ</Text>
                                      )}
                                    </View>
                                    <View style={styles.foodBottomColumn}>
                                      {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        {getCartQuantity(item.id) > 0 ? (
                                          <View style={[styles.activeQuantityContainer, { marginTop: 0 }]}>
                                            <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                                              <MaterialIcons name="remove" size={14} color="#fff" />
                                            </TouchableOpacity>
                                            <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                                            <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.activeQtyBtn}>
                                              <MaterialIcons name="add" size={14} color="#fff" />
                                            </TouchableOpacity>
                                          </View>
                                        ) : (
                                          item.status !== 'sold_out' && (
                                            <TouchableOpacity
                                              style={[styles.addBtnLarge, { marginTop: 0 }]}
                                              onPress={(e) => { e.stopPropagation?.(); handleAddToCart(item); }}
                                            >
                                              <MaterialIcons name="add" size={14} color="#fff" />
                                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>EKLE</Text>
                                            </TouchableOpacity>
                                          )
                                        )}
                                      </View>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })
                    }
                  </>
                )}

                {/* Sistem ekstraları */}
                {ekstraSystemItems.length > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 20 }} />
                    <Text style={{ fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Sabit Ekstralar</Text>
                    {ekstraSystemItems.map(item => (
                      <View key={item.id} style={[styles.foodCard, { marginBottom: 10 }]}>
                        <View style={styles.foodImageContainer}>
                          <MaterialIcons name="add-circle-outline" size={36} color={colors.muted} />
                        </View>
                        <View style={styles.foodDetails}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.foodName}>{item.name}</Text>
                            <Text style={styles.foodCategory}>Ekstra</Text>
                          </View>
                          <View style={styles.foodBottomColumn}>
                            {!profileLoading && !isCompany && <Text style={styles.foodPrice}>₺{item.price}</Text>}
                            {getCartQuantity(item.id) > 0 ? (
                              <View style={[styles.activeQuantityContainer, { marginTop: 8 }]}>
                                <TouchableOpacity onPress={() => handleDecrement(item.id)} style={styles.activeQtyBtn}>
                                  <MaterialIcons name="remove" size={14} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.activeQtyText}>{getCartQuantity(item.id)}</Text>
                                <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.activeQtyBtn}>
                                  <MaterialIcons name="add" size={14} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity style={[styles.addBtnLarge, { marginTop: 8 }]} onPress={() => handleAddToCart(item)}>
                                <MaterialIcons name="add" size={14} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>EKLE</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* Avantajlı Tabldot Menü Section */}
        {TABLDOT_PACKAGES.length > 0 && (selectedCategory === "TÜMÜ" || selectedCategory === "TABLDOT") && (
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 12 }}>Avantajlı Tabldot Menü</Text>
            {TABLDOT_PACKAGES.map(pkg => {
              const cleanLabel = pkg.maxItems === 4 ? "4'LÜ TABLDOT" : pkg.maxItems === 3 ? "3'LÜ TABLDOT" : "2'Lİ TABLDOT";
              return (
              <TouchableOpacity key={pkg.id} style={{ backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 }} onPress={() => handleAddToCart(pkg)}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ backgroundColor: colors.cardHighlight, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <MaterialIcons name="restaurant-menu" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>{cleanLabel}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 16 }}>{pkg.desc}</Text>
                  </View>
                </View>

                {/* Alt Kısım (Fiyat ve Butonlar) */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
                  {!profileLoading && !isCompany && <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary, marginRight: 12 }}>₺{pkg.price}</Text>}

                  {getCartQuantity(pkg.id) > 0 ? (
                    <View style={[styles.activeQuantityContainer, { marginTop: 0 }]}>
                      <TouchableOpacity onPress={() => handleDecrement(pkg.id)} style={styles.activeQtyBtn}>
                        <MaterialIcons name="remove" size={18} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.activeQtyText}>{getCartQuantity(pkg.id)}</Text>
                      <TouchableOpacity onPress={() => handleAddToCart(pkg)} style={styles.activeQtyBtn}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.addBtnLarge, { marginTop: 0 }]} onPress={() => handleAddToCart(pkg)}>
                      <MaterialIcons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>EKLE</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
              )
            })}
          </View>
        )}
        {selectedCategory === "TABLDOT" && TABLDOT_PACKAGES.length === 0 && (
           <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: colors.muted }}>Bu kategoride aktif ürün yok</Text>
           </View>
        )}
      </ScrollView>
      )}

      {/* Floating Forward Button */}
      {totalCartCount > 0 && (
        <TouchableOpacity 
          style={{
            position: 'absolute', bottom: 40, left: 24, right: 24,
            backgroundColor: colors.primary, padding: 16, borderRadius: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5
          }}
          onPress={() => router.push("/(tabs)/cart")}
          activeOpacity={0.9}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 }}>Siparişi Tamamla</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Ürün Detay / Sepete Ekle Modalı ── */}
      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '80%' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: colors.surfaceBorder }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ backgroundColor: colors.cardHighlight, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {CAT_LABELS[detailItem?.category] || detailItem?.category}
                  </Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, lineHeight: 26 }}>{detailItem?.name}</Text>
                {!profileLoading && !isCompany && detailItem?.price && (
                  <Text style={{ fontSize: 16, fontWeight: '900', color: colors.primary, marginTop: 4 }}>₺{detailItem.price}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ backgroundColor: colors.surface, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {/* Ürün durumu */}
              {detailItem?.status === 'sold_out' && (
                <View style={{ backgroundColor: colors.danger + '20', borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="cancel" size={18} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontWeight: 'bold', fontSize: 13 }}>Bu ürün tükenmiştir</Text>
                </View>
              )}

              {/* Aynı kategorideki diğer öğeler — bağlam bilgisi */}
              {detailContext.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
                    Bugün Bu Kategoride Ayrıca
                  </Text>
                  {detailContext.map(sibling => (
                    <View key={sibling.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sibling.status === 'sold_out' ? colors.danger : colors.primary, marginRight: 12 }} />
                      <Text style={{ flex: 1, fontSize: 14, color: sibling.status === 'sold_out' ? colors.muted : colors.text, fontWeight: '600' }}>{sibling.name}</Text>
                      {sibling.status === 'sold_out' && (
                        <Text style={{ fontSize: 10, color: colors.danger, fontWeight: 'bold' }}>TÜKENDİ</Text>
                      )}
                      {!profileLoading && !isCompany && sibling.status !== 'sold_out' && (
                        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary }}>₺{sibling.price}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Sepete ekleme bölümü */}
              {detailItem?.status !== 'sold_out' && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>Sepete Ekle</Text>
                  {getCartQuantity(detailItem?.id) > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                      <TouchableOpacity onPress={() => detailItem && handleDecrement(detailItem.id)} style={[styles.activeQtyBtn, { width: 44, height: 44, borderRadius: 12 }]}>
                        <MaterialIcons name="remove" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, minWidth: 30, textAlign: 'center' }}>{getCartQuantity(detailItem?.id)}</Text>
                      <TouchableOpacity onPress={() => detailItem && handleAddToCart(detailItem)} style={[styles.activeQtyBtn, { width: 44, height: 44, borderRadius: 12 }]}>
                        <MaterialIcons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtnLarge, { width: '100%', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, marginTop: 0 }]}
                      onPress={() => { if (detailItem) { handleAddToCart(detailItem); }}}
                    >
                      <MaterialIcons name="add-shopping-cart" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>Sepete Ekle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Package Selection Modal */}
      <Modal visible={packageModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderColor: colors.surfaceBorder }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>{selectedPackage?.maxItems ? `${selectedPackage.maxItems}'LÜ TABLDOT` : selectedPackage?.name}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{selectedPackage?.maxItems} Çeşit Ürün Seçiniz</Text>
              </View>
              <TouchableOpacity onPress={() => setPackageModalVisible(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
              {Array.from(new Set(dailyMenu.map(m => m.category)))
                .filter(cat => cat !== "İÇECEKLER" && cat !== "İÇECEK" && cat !== "TEK_ÇEŞİT")
                .sort((a, b) => {
                  const order = ["ÇORBA ÇEŞİTLERİ", "ANA YEMEK", "YARDIMCI", "TAMAMLAYICI"];
                  const indexA = order.indexOf(a);
                  const indexB = order.indexOf(b);
                  if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                  if (indexA === -1) return 1;
                  if (indexB === -1) return -1;
                  return indexA - indexB;
                })
                .map(catName => {
                const catItems = dailyMenu.filter(m => m.category === catName);
                if (catItems.length === 0) return null;
                
                return (
                  <View key={catName} style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.muted, marginBottom: 12 }}>{catName}</Text>
                    {catItems.map(item => {
                      const isSelected = packageSelections.find(s => s.item_id === item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.modalMealCard, isSelected && styles.modalMealCardActive]}
                          onPress={() => togglePackageSelection(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalMealName}>{item.name}</Text>
                          </View>
                          {isSelected && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )
              })}
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.surfaceBorder }}>
              <TouchableOpacity style={[styles.confirmPackageBtn, { margin: 0 }]} onPress={handleConfirmPackage}>
                <Text style={styles.confirmPackageBtnText}>Paketi Onayla ({packageSelections.length}/{selectedPackage?.maxItems})</Text>
                {profileLoading || isCompany ? null : <Text style={styles.confirmPackagePriceInfo}>₺{selectedPackage?.price}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  subtitle: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  cartButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryScrollContainer: {
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  categoryBtnActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.muted,
  },
  categoryTextActive: {
    color: "#fff",
  },
  listContainer: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    color: colors.muted,
    fontWeight: "bold",
    fontSize: 16,
  },
  foodCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  foodImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
  },
  foodImage: {
    width: "100%",
    height: "100%",
  },
  foodDetails: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: "space-between",
    alignItems: "center",
  },
  foodName: {
    fontSize: 15,
    fontWeight: "bold",
    color: colors.text,
    lineHeight: 20,
  },
  foodCategory: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
    marginTop: 4,
  },
  foodBottomColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 60,
  },
  foodPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primary,
  },
  addBtn: {
    backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  addBtnLarge: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center'
  },
  activeQuantityContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.primary, marginTop: 6,
  },
  activeQtyBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8,
  },
  activeQtyText: {
    fontSize: 16, fontWeight: 'bold', color: colors.text, marginHorizontal: 12, minWidth: 20, textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalSubtitle: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    color: colors.muted,
    fontSize: 13,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  modalCategoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.muted,
    marginBottom: 8,
    marginTop: 12,
  },
  modalMealCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalMealCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.cardHighlight,
  },
  modalMealName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  confirmPackageBtn: {
    backgroundColor: colors.primary,
    padding: 20,
    margin: 24,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmPackageBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmPackagePriceInfo: {
    color: '#dcfce7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
});
