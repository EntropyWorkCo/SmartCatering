import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef } from "react";
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
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
  const { profile, refresh } = useProfile(user?.id);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [user?.id])
  );
  const { orders } = useAdisyon(user?.id);
  const { menu } = useMenu(true);
  const cartItems = useCartStore((state) => state.items);

  const [modalVisible, setModalVisible] = React.useState(false);
  const [timeFilter, setTimeFilter] = React.useState<"ALL" | "DAILY" | "WEEKLY" | "MONTHLY">("ALL");
  const [quantities, setQuantities] = React.useState<{ [key: string]: number }>({});
  const hasAlertedMenuRef = useRef(false);

  const isCompany = profile?.is_company || false;
  const getQuantity = (id: string) => quantities[id] || 1;
  const setQuantity = (id: string, val: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, val) }));
  };

  const dailyMenu = useMemo(() => {
    return menu.filter(m => ["ÇORBA", "ANA YEMEK", "YARDIMCI"].includes(m.category));
  }, [menu]);

  useEffect(() => {
    const checkNotification = async () => {
      if (dailyMenu.length > 0 && !hasAlertedMenuRef.current) {
        // 1. Kullanıcı bildirimleri kapatmış mı?
        const isEnabled = await AsyncStorage.getItem("notifications_enabled");
        if (isEnabled === "false") return;

        // 2. Bu menü için zaten bildirim gösterildi mi? (Sadece yeni menü uyarısı)
        const menuIds = dailyMenu.map(m => m.id).sort().join(",");
        const lastNotifiedMenu = await AsyncStorage.getItem("last_notified_menu");

        if (lastNotifiedMenu !== menuIds) {
          Alert.alert(
            "Günün Menüsü Hazır! 🍲",
            "Bugünün taptaze sıcak yemekleri yayınlandı. Hemen inceleyip siparişini verebilirsin!",
            [{ text: "Tamam", style: "default" }]
          );
          await AsyncStorage.setItem("last_notified_menu", menuIds);
        }
        hasAlertedMenuRef.current = true;
      }
    };
    checkNotification();
  }, [dailyMenu]);

  const handleAddToCart = (item: any) => {
    const quantity = getQuantity(item.id);
    useCartStore.getState().addItem({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      quantity: quantity,
      is_package: item.category === "PAKET" || item.category === "TABLDOT",
    });
    Alert.alert("Eklendi", `${quantity} adet ${item.name} sepete eklendi.`);
    setQuantities(prev => ({ ...prev, [item.id]: 1 }));
  };

  const cartItemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  const filteredUnpaidOrders = useMemo(() => {
    if (!orders) return [];

    const unpaid = orders.filter((o) => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status));

    const now = new Date();
    return unpaid.filter(order => {
      if (timeFilter === "ALL") return true;

      const orderDate = new Date(order.created_at || order.date);
      const diffTime = Math.abs(now.getTime() - orderDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (timeFilter === "DAILY") {
        return orderDate.getDate() === now.getDate() && orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (timeFilter === "WEEKLY") return diffDays <= 7;
      if (timeFilter === "MONTHLY") return diffDays <= 30;
      return true;
    }).sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  }, [orders, timeFilter]);

  const currentDebt = useMemo(() => {
    return filteredUnpaidOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  }, [filteredUnpaidOrders]);

  // Last order based on date
  const lastOrder = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    return [...orders].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0];
  }, [orders]);

  const [localPhoto, setLocalPhoto] = React.useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      AsyncStorage.getItem(`profile_photo_${user.id}`).then(photo => {
        if (photo) setLocalPhoto(photo);
      });
    }
  }, [user?.id]);

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || "Misafir";
  const profileImage = localPhoto || profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/png?seed=${firstName}`;

  const generatePdf = async () => {
    if (!orders) return;
    const unpaidOrders = filteredUnpaidOrders;

    if (unpaidOrders.length === 0) {
      Alert.alert("Bilgi", "Seçili tarihte ödenmemiş borcunuz bulunmuyor.");
      return;
    }

    const dateStr = new Date().toLocaleDateString('tr-TR');

    const tableRows = unpaidOrders.map((o: any) => {
      const d = new Date(o.created_at || o.date);
      const dateFormatted = `${d.toLocaleDateString('tr-TR')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #ddd;">${dateFormatted}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ddd;">
              ${o.adisyon_items?.map((item: any) => `${item.quantity}x ${item.menu_items?.name || 'Yemek'}`).join('<br>') || 'Detay yok'}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₺${o.total_amount?.toLocaleString("tr-TR")}</td>
        </tr>
    `;
    }).join('');

    const html = `
        <html>
            <body style="font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #333;">
                <h1 style="color: ${colors.primary}; margin-bottom: 5px;">Smart Catering</h1>
                <h2 style="color: #666; font-weight: normal; margin-top: 0;">Güncel Borç Dökümü</h2>
                <p style="color: #888; font-size: 12px;">Müşteri: ${profile?.full_name || 'Misafir'}</p>
                <p style="color: #888; font-size: 12px;">Tarih: ${dateStr}</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
                    <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Toplam Ödenmemiş Borç</p>
                    <h2 style="margin: 10px 0 0 0; color: #e11d48;">₺${currentDebt.toLocaleString("tr-TR")}</h2>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; text-align: left;">
                            <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666;">TARIH</th>
                            <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666;">URUNLER</th>
                            <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666; text-align: right;">TUTAR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </body>
        </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Bilgi", "PDF oluşturuldu ancak bu cihazda paylaşım desteklenmiyor.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
    }
  };

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
            <ThemeSwitcher />
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
        <TouchableOpacity activeOpacity={0.9} onPress={() => setModalVisible(true)}>
          <View style={styles.balanceCard}>
            <MaterialIcons name="account-balance-wallet" size={140} color={theme === 'dark' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} style={styles.balanceBgIcon} />

            <Text style={styles.balanceLabel}>GÜNCEL BORÇ BAKİYESİ</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>₺{currentDebt.toLocaleString('tr-TR')}</Text>
              <Text style={styles.balanceCurrency}>TL</Text>
            </View>

            <View style={styles.balanceDivider} />

            <View style={styles.balanceFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {orders && orders.filter(o => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status)).length > 0 ? (
                  <Text style={{ fontSize: 11, color: theme === 'dark' ? colors.muted : '#064e3b', fontWeight: 'bold' }}>
                    {orders.filter(o => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status)).length} Ödenmemiş Adisyon
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.text === '#f8fafc' ? '#064e3b' : '#cbd5e1', fontWeight: 'bold' }}>Borcunuz bulunmuyor</Text>
                )}
              </View>
              <Text style={styles.lastPaymentText}>TOPLAM BEKLEYEN: ₺{currentDebt.toLocaleString('tr-TR')}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Actions Grid */}
        <View style={styles.gridContainer}>
          <ActionCard
            icon="restaurant-menu" title="SİPARİŞ VER" subtitle="Hızlı & Taze"
            bgColor="#10b981" onPress={() => router.push("/(tabs)/menu")}
          />
        </View>

        {/* Removed Last Order Highlight based on user request */}

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
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.foodCategory}>{item.category}</Text>
                    </View>
                    <View style={styles.foodBottomColumn}>
                      <Text style={styles.foodPrice}>₺{item.price}</Text>
                      {item.status === 'sold_out' ? (
                        <View style={{ backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>TÜKENDİ</Text>
                        </View>
                      ) : (
                        isCompany ? (
                          <View style={[styles.quantityContainer, { marginTop: 8 }]}>
                            <TouchableOpacity onPress={() => setQuantity(item.id, getQuantity(item.id) - 1)} style={styles.qtyBtn}>
                              <MaterialIcons name="remove" size={14} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={styles.qtyTextSmall}>{getQuantity(item.id)}</Text>
                            <TouchableOpacity onPress={() => setQuantity(item.id, getQuantity(item.id) + 1)} style={styles.qtyBtn}>
                              <MaterialIcons name="add" size={14} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.addBtn, { marginLeft: 8, width: 32, height: 32 }]} onPress={() => handleAddToCart(item)}>
                              <MaterialIcons name="add-shopping-cart" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.addBtn} onPress={() => handleAddToCart(item)}>
                            <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Removed Popular Section based on user request */}


      </ScrollView>

      {/* Borç Detayı Modalı */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Ödenmemiş Adisyonlar</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Toplam Borcunuz: <Text style={{ fontWeight: 'bold', color: colors.primary }}>₺{currentDebt.toLocaleString('tr-TR')}</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity onPress={generatePdf} style={styles.modalPdfBtn}>
                  <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>İNDİR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterContainer}>
              {(['ALL', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterBtn, timeFilter === filter && styles.filterBtnActive]}
                  onPress={() => setTimeFilter(filter)}
                >
                  <Text style={[styles.filterBtnText, timeFilter === filter && styles.filterBtnTextActive]}>
                    {filter === 'ALL' ? 'Tümü' : filter === 'DAILY' ? 'Günlük' : filter === 'WEEKLY' ? 'Haftalık' : 'Aylık'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredUnpaidOrders.length > 0 ? (
                filteredUnpaidOrders.map(order => {
                  const date = new Date(order.created_at || order.date);
                  return (
                    <View key={order.id} style={[styles.modalOrderCard, { borderColor: colors.surfaceBorder, backgroundColor: colors.surface }]}>
                      <View style={styles.modalOrderHeader}>
                        <Text style={[styles.modalOrderDate, { color: colors.text }]}>
                          {date.toLocaleDateString('tr-TR')} {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                        </Text>
                        <Text style={[styles.modalOrderTotal, { color: colors.primary }]}>₺{order.total_amount || 0}</Text>
                      </View>

                      {order.adisyon_items && order.adisyon_items.length > 0 ? (
                        order.adisyon_items.map((item: any) => (
                          <View key={item.id} style={styles.modalItemRow}>
                            <Text style={[styles.modalItemCount, { color: colors.text }]}>{item.quantity}x </Text>
                            <Text style={[styles.modalItemName, { color: colors.muted }]}>{item.menu_items?.name || 'Yemek'}</Text>
                            <Text style={[styles.modalItemPrice, { color: colors.text }]}>₺{item.line_total}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>Paket içeriği gösterilemiyor.</Text>
                      )}
                      {order.note && <Text style={{ fontSize: 11, color: colors.info, marginTop: 8, fontStyle: 'italic' }}>Not: {order.note}</Text>}
                    </View>
                  );
                })
              ) : (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialIcons name="done-all" size={48} color={colors.primary} />
                  <Text style={{ marginTop: 12, fontSize: 16, fontWeight: 'bold', color: colors.text }}>Harika!</Text>
                  <Text style={{ marginTop: 4, color: colors.muted, textAlign: 'center' }}>Ödenmemiş veya bekleyen borcunuz bulunmuyor.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flex: 1, // To make them take up half the width each nicely
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
  foodDetails: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: "space-between",
    alignItems: "center"
  },
  foodName: { fontSize: 15, fontWeight: "bold", color: colors.text, lineHeight: 20 },
  foodCategory: { fontSize: 11, color: colors.muted, fontWeight: "600", marginTop: 4 },
  foodBottomColumn: { alignItems: "flex-end", justifyContent: "center", minWidth: 60 },
  foodPrice: { fontSize: 18, fontWeight: "900", color: colors.primary },
  addBtn: {
    backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  quantityContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.surfaceBorder,
    marginTop: 6,
  },
  qtyBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 8,
  },
  qtyTextSmall: {
    fontSize: 14, fontWeight: 'bold', color: colors.text, marginHorizontal: 8, minWidth: 15, textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterContainer: {
    flexDirection: 'row', marginBottom: 16, gap: 8, justifyContent: 'space-between'
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
  },
  filterBtnActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  filterBtnText: {
    fontSize: 10, fontWeight: 'bold', color: colors.muted
  },
  filterBtnTextActive: {
    color: '#fff'
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  modalPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalOrderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modalOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  modalOrderDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOrderTotal: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalItemCount: {
    fontSize: 13,
    fontWeight: '900',
    width: 24,
  },
  modalItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});


