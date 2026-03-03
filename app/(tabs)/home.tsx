import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMenu } from "@/lib/hooks/useMenu";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCartStore } from "@/lib/store/cartStore";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function HomeScreen() {
  const router = useRouter();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { orders } = useAdisyon(user?.id);
  const { menu } = useMenu(true);
  const cartItems = useCartStore((state) => state.items);

  const dailyMenu = useMemo(() => {
    return menu.filter(m => ["ÇORBA", "ANA YEMEK", "YARDIMCI"].includes(m.category));
  }, [menu]);

  const handleAddToCart = (item: any) => {
    useCartStore.getState().addItem({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      is_package: item.category === "PAKET",
    });
    // Can optionally show toast or alert, skipped for brevity or use minimal alert:
    // Alert.alert("Eklendi", `${item.name} sepete eklendi.`);
  };

  const cartItemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  const currentDebt = useMemo(() => {
    if (!orders) return 0;
    const pendingOrders = orders.filter((o) => o.status === "PENDING" || o.status === "Bekliyor");
    return pendingOrders.reduce((acc, curr) => acc + (curr.total_price || curr.total || 0), 0);
  }, [orders]);

  // Last order based on date
  const lastOrder = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    return [...orders].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0];
  }, [orders]);

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || "Misafir";
  const profileImage = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/png?seed=${firstName}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.greetingText}>Merhaba, {firstName}!</Text>
            <Text style={styles.subtitleText}>BUGÜN NE YEMEK İSTERSİN?</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={() => router.push("/(tabs)/cart")}
              activeOpacity={0.8}
            >
              <MaterialIcons name="shopping-bag" size={24} color={colors.text} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            </View>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <MaterialIcons name="account-balance-wallet" size={140} color={theme === 'dark' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} style={styles.balanceBgIcon} />

          <Text style={styles.balanceLabel}>GÜNCEL BORÇ BAKİYESİ</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>₺{currentDebt.toLocaleString('tr-TR')}</Text>
            <Text style={styles.balanceCurrency}>TL</Text>
          </View>

          <View style={styles.balanceDivider} />

          <View style={styles.balanceFooter}>
            <View style={styles.avatarStack}>
              {[1, 2, 3].map(i => (
                <Image key={i} source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${i + 10}` }} style={[styles.stackAvatar, { zIndex: 4 - i, marginLeft: i === 1 ? 0 : -10 }]} />
              ))}
              <View style={[styles.stackMore, { zIndex: 0 }]}>
                <Text style={styles.stackMoreText}>+12</Text>
              </View>
            </View>
            <Text style={styles.lastPaymentText}>BEKLEYEN: ₺{currentDebt.toLocaleString('tr-TR')}</Text>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.gridContainer}>
          <ActionCard
            icon="restaurant-menu" title="SİPARİŞ VER" subtitle="Hızlı & Taze"
            bgColor="#10b981" onPress={() => router.push("/order-selection")}
          />
          <ActionCard
            icon="menu-book" title="MENÜYÜ GÖR" subtitle="Günlük Seçimler"
            bgColor="#f59e0b" onPress={() => router.push("/(tabs)/menu")}
          />
          <ActionCard
            icon="history" title="GEÇMİŞİM" subtitle="Tüm Siparişler"
            bgColor="#3b82f6" onPress={() => router.push("/(tabs)/past-orders")}
          />
          <ActionCard
            icon="shopping-cart" title="SEPETİM" subtitle={`${cartItemCount} Ürün Var`}
            bgColor={colors.primary} onPress={() => router.push("/(tabs)/cart")}
          />
        </View>

        {/* Last Order Highlight */}
        {lastOrder && (
          <View style={styles.lastOrderSection}>
            <Text style={styles.sectionTitle}>SON SİPARİŞİNİZ</Text>
            <TouchableOpacity
              style={styles.lastOrderCard}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/past-orders")}
            >
              <View style={styles.lastOrderIconBox}>
                <MaterialIcons name="receipt-long" size={28} color={colors.primary} />
              </View>
              <View style={styles.lastOrderInfo}>
                <Text style={styles.lastOrderName} numberOfLines={1}>Sipariş #{lastOrder.order_number || lastOrder.id?.substring(0, 6)}</Text>
                <Text style={styles.lastOrderDate}>
                  {new Date(lastOrder.created_at || lastOrder.date).toLocaleDateString('tr-TR')} • ₺{lastOrder.total_price || lastOrder.total}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Günün Menüsü (Menu of the Day) */}
        {dailyMenu.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={styles.popularHeader}>
              <Text style={styles.sectionTitle}>GÜNÜN MENÜSÜ</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/menu")}>
                <Text style={styles.seeAllText}>TÜMÜNÜ GÖR</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 16 }}>
              {dailyMenu.map(item => (
                <View key={item.id} style={[styles.foodCard, item.status === 'sold_out' && { opacity: 0.6 }]}>
                  <View style={styles.foodImageContainer}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.foodImage} />
                    ) : (
                      <MaterialIcons name={
                        item.category === "ÇORBA" ? "soup-kitchen" : "restaurant"
                      } size={40} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.foodDetails}>
                    <Text style={styles.foodName}>{item.name}</Text>
                    <Text style={styles.foodCategory}>{item.category}</Text>
                    <View style={styles.foodBottomRow}>
                      <Text style={styles.foodPrice}>₺{item.price}</Text>
                      {item.status === 'sold_out' ? (
                        <View style={{ backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>TÜKENDİ</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addBtn} onPress={() => handleAddToCart(item)}>
                          <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Popular Section */}
        <View style={styles.popularSection}>
          <View style={styles.popularHeader}>
            <Text style={styles.sectionTitle}>POPÜLER LEZZETLER</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/menu")}>
              <Text style={styles.seeAllText}>TÜMÜ</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
            {menu.slice(0, 5).map(item => (
              <TouchableOpacity key={item.id} style={styles.popularCard} activeOpacity={0.9} onPress={() => router.push("/(tabs)/menu")}>
                <View style={styles.popularImgBox}>
                  <Image source={{ uri: item.image_url || `https://picsum.photos/seed/${item.id}food/200` }} style={styles.popularImg} />
                </View>
                <Text style={styles.popularItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.popularItemPrice}>₺{item.price}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const ActionCard = ({ icon, title, subtitle, bgColor, onPress }: any) => {
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  return (
    <TouchableOpacity style={[stylesBase.actionCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]} activeOpacity={0.8} onPress={onPress}>
      <View style={[stylesBase.actionIconBox, { backgroundColor: bgColor }]}>
        <MaterialIcons name={icon} size={20} color="#fff" />
      </View>
      <View style={stylesBase.actionTexts}>
        <Text style={[stylesBase.actionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[stylesBase.actionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
};

const stylesBase = StyleSheet.create({
  actionCard: {
    borderRadius: 24, padding: 16,
    borderWidth: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  actionIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  actionTexts: {},
  actionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: -0.2 },
  actionSubtitle: { fontSize: 9, fontWeight: 'bold', marginTop: 2, textTransform: 'uppercase' },
});

const getStyles = (colors: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 24, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  headerTitles: { flex: 1 },
  greetingText: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: 4 },
  subtitleText: { fontSize: 10, fontWeight: '900', color: colors.muted, letterSpacing: 1.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBtn: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    position: 'relative'
  },
  cartBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background
  },
  cartBadgeText: { fontSize: 10, fontWeight: '900', color: '#0f172a' },
  avatarContainer: {
    width: 48, height: 48, borderRadius: 16,
    borderWidth: 2, borderColor: colors.primary,
    overflow: 'hidden', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  avatar: { width: '100%', height: '100%' },

  balanceCard: {
    backgroundColor: colors.text === '#f8fafc' ? colors.primary : '#0f172a', // Dark theme: Primary, Light Theme: Dark Slate
    borderRadius: 32, padding: 32, marginBottom: 32,
    position: 'relative', overflow: 'hidden',
    shadowColor: colors.text === '#f8fafc' ? colors.primary : '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10
  },
  balanceBgIcon: { position: 'absolute', top: 0, right: 0, padding: 20 },
  balanceLabel: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    color: colors.text === '#f8fafc' ? '#064e3b' : '#94a3b8',
    marginBottom: 8, opacity: 0.8
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  balanceValue: {
    fontSize: 36, fontWeight: '900', letterSpacing: -1,
    color: colors.text === '#f8fafc' ? '#022c22' : '#ffffff'
  },
  balanceCurrency: {
    fontSize: 14, fontWeight: 'bold',
    color: colors.text === '#f8fafc' ? '#064e3b' : '#94a3b8', opacity: 0.6
  },
  balanceDivider: {
    height: 1, width: '100%', marginVertical: 24,
    backgroundColor: colors.text === '#f8fafc' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  },
  balanceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.text === '#f8fafc' ? colors.primary : '#0f172a' },
  stackMore: {
    width: 28, height: 28, borderRadius: 14, marginLeft: -10,
    borderWidth: 2, borderColor: colors.text === '#f8fafc' ? colors.primary : '#0f172a',
    backgroundColor: colors.text === '#f8fafc' ? '#064e3b' : '#334155',
    alignItems: 'center', justifyContent: 'center'
  },
  stackMoreText: { fontSize: 8, fontWeight: '900', color: '#fff' },
  lastPaymentText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1,
    color: colors.text === '#f8fafc' ? '#064e3b' : '#94a3b8', opacity: 0.8
  },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 32 },

  lastOrderSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: colors.muted, letterSpacing: 1.5, marginBottom: 16, paddingHorizontal: 4 },
  lastOrderCard: {
    backgroundColor: colors.surface, borderRadius: 32, padding: 20,
    borderWidth: 1, borderColor: colors.surfaceBorder,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  lastOrderIconBox: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center'
  },
  lastOrderInfo: { flex: 1 },
  lastOrderName: { fontSize: 14, fontWeight: '900', color: colors.text },
  lastOrderDate: { fontSize: 11, fontWeight: 'bold', color: colors.muted, marginTop: 4, textTransform: 'uppercase' },

  popularSection: {},
  popularHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  seeAllText: { fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 1.5 },
  popularScroll: { gap: 16, paddingBottom: 16 },
  popularCard: {
    width: 150, backgroundColor: colors.surface, borderRadius: 32, padding: 16,
    borderWidth: 1, borderColor: colors.surfaceBorder,
  },
  popularImgBox: {
    width: "100%", height: 110, borderRadius: 24, overflow: 'hidden',
    backgroundColor: colors.background, marginBottom: 12,
    borderWidth: 1, borderColor: colors.surfaceBorder
  },
  popularImg: { width: '100%', height: '100%' },
  popularItemName: { fontSize: 12, fontWeight: '900', color: colors.text, marginBottom: 4 },
  popularItemPrice: { fontSize: 14, fontWeight: '900', color: colors.primary },

  // Günün Menüsü Card Styles (borrowed from menu.tsx but scoped here)
  foodCard: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 24, padding: 12,
    borderWidth: 1, borderColor: colors.surfaceBorder,
  },
  foodImageContainer: {
    width: 90, height: 90, borderRadius: 16, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", overflow: 'hidden',
  },
  foodImage: { width: "100%", height: "100%" },
  foodDetails: { flex: 1, marginLeft: 16, justifyContent: "space-between", paddingVertical: 4 },
  foodName: { fontSize: 16, fontWeight: "bold", color: colors.text },
  foodCategory: { fontSize: 11, color: colors.muted, fontWeight: "600", marginTop: 4 },
  foodBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  foodPrice: { fontSize: 18, fontWeight: "900", color: colors.primary },
  addBtn: {
    backgroundColor: colors.text, width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
});

