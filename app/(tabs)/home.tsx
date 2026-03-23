import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMenu } from "@/lib/hooks/useMenu";
import { useProfile } from "@/lib/hooks/useProfile";
import { adisyonService } from "@/lib/services/adisyonService";
import { useCartStore } from "@/lib/store/cartStore";
import { useResolvedTheme } from "@/lib/store/themeStore";

export default function HomeScreen() {
  const router = useRouter();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);

  const { user, loading: authLoading } = useAuth();
  const { profile, refresh } = useProfile(user?.id);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [user?.id])
  );
  // Supabase uuid beklediği için standart boş uuid gönderiyoruz
  const { orders } = useAdisyon(authLoading ? "00000000-0000-0000-0000-000000000000" : user?.id || "00000000-0000-0000-0000-000000000000");
  const { menu, systemPrices } = useMenu(true);
  const cartItems = useCartStore((state) => state.items);
  const orderMode = useCartStore((state) => state.orderMode);
  const setOrderMode = useCartStore((state) => state.setOrderMode);

  const [modalVisible, setModalVisible] = React.useState(false);

  const TABLDOT_PACKAGES = useMemo(() => {
    return (systemPrices || [])
      .filter(p => p.category === "TABLDOT")
      .map(pkg => {
        let maxItems = 4;
        let desc = "4 çeşit yemek (Örn: Çorba, Ana Yemek, 2 Yardımcı)";
        if (pkg.name.includes("3") || pkg.name.includes("3 ÇEŞİT")) {
          maxItems = 3;
          desc = "3 çeşit yemek (Örn: Çorba, Ana Yemek, Yardımcı)";
        } else if (pkg.name.includes("2") || pkg.name.includes("2 ÇEŞİT")) {
          maxItems = 2;
          desc = "2 çeşit yemek (Örn: Çorba, Ana Yemek)";
        }
        return { id: pkg.id, name: pkg.name, price: pkg.price, category: "PAKET", maxItems, desc };
      })
      .sort((a, b) => b.price - a.price);
  }, [systemPrices]);
  const [timeFilter, setTimeFilter] = React.useState<"ALL" | "DAILY" | "WEEKLY" | "MONTHLY">("ALL");
  const [quantities, setQuantities] = React.useState<{ [key: string]: number }>({});
  const [companyOrders, setCompanyOrders] = React.useState<any[]>([]);
  const [companyOrdersLoading, setCompanyOrdersLoading] = React.useState(false);
  const hasAlertedMenuRef = useRef(false);

  const isCompany = profile?.is_company || false;
  const isCompanyOwner = !!profile?.corporate_info;
  const actualCompanyId = profile?.company_id || profile?.corporate_info?.id; 

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

  // Load Corporate Orders for Owner
  useEffect(() => {
    const loadCompanyOrders = async () => {
      if (!isCompanyOwner || !actualCompanyId) return;
      setCompanyOrdersLoading(true);
      try {
        const data = await adisyonService.getCompanyOrders(actualCompanyId);
        setCompanyOrders(data || []);
      } catch (e) {
        console.error("Owner orders load error:", e);
      } finally {
        setCompanyOrdersLoading(false);
      }
    };
    loadCompanyOrders();
  }, [isCompanyOwner, actualCompanyId]);

  const handlePressAction = (mode: 'eat_now' | 'pre_order') => {
    if (cartItemCount > 0 && orderMode !== mode && orderMode !== null) {
      Alert.alert(
        "Sepetiniz Sıfırlanacak",
        `Sepetinizde zaten '${orderMode === 'eat_now' ? 'Şimdi Ye' : 'Sipariş Ver'}' ürünleri bulunuyor. Diğer moda geçmek sepetinizi sıfırlayacaktır. Devam etmek istiyor musunuz?`,
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Sepeti Boşalt ve Geç", style: "destructive", onPress: () => {
              useCartStore.getState().clearCart();
              setOrderMode(mode);
              router.push("/(tabs)/menu");
          }}
        ]
      );
    } else {
      setOrderMode(mode);
      router.push("/(tabs)/menu");
    }
  };

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

        {/* Quick Actions Grid (Main Order Flows) */}
        <View style={styles.gridContainer}>
          <ActionCard
            icon="restaurant" title="ŞİMDİ YE" subtitle="Hemen Teslim"
            bgColor="#f59e0b" 
            onPress={() => handlePressAction('eat_now')}
            isDisabled={cartItemCount > 0 && orderMode === 'pre_order'}
          />
          <ActionCard
            icon="event-note" title="SİPARİŞ VER" subtitle="Önceden Planla"
            bgColor="#10b981" 
            onPress={() => handlePressAction('pre_order')}
            isDisabled={cartItemCount > 0 && orderMode === 'eat_now'}
          />
        </View>

        {/* Tabldot Seçenekleri (Hızlı Ekleme) */}
        {TABLDOT_PACKAGES.length > 0 && (
          <View style={{ marginBottom: 32, marginTop: 16 }}>
             <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>HIZLI TABLDOT (ŞİMDİ YE)</Text>
             <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 16, paddingHorizontal: 6, lineHeight: 16 }}>
                 * Restoranda yiyecekseniz <Text style={{fontWeight: 'bold', color: colors.text}}>4'LÜ TABLDOT</Text>, <Text style={{fontWeight: 'bold', color: colors.text}}>3'LÜ TABLDOT</Text> veya <Text style={{fontWeight: 'bold', color: colors.text}}>2'Lİ TABLDOT</Text> menülerinden birini seçebilirsiniz.
             </Text>
             <View style={{ gap: 12 }}>
                {TABLDOT_PACKAGES.map(pkg => {
                    const inCartCount = cartItems.find(i => i.menu_item_id === pkg.id)?.quantity || 0;
                    const cleanLabel = pkg.maxItems === 4 ? "4'LÜ TABLDOT" : pkg.maxItems === 3 ? "3'LÜ TABLDOT" : "2'Lİ TABLDOT";
                    
                    return (
                        <View key={pkg.id} style={[styles.foodCard, { padding: 16, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ backgroundColor: colors.cardHighlight, width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                    <Text style={{ fontSize: 20, fontWeight: '900', color: colors.primary }}>{pkg.maxItems}</Text>
                                </View>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>{cleanLabel}</Text>
                                    <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 16 }}>{pkg.desc}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                                {!isCompany ? <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary }}>₺{pkg.price}</Text> : <View />}
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary, marginBottom: 8, textTransform: 'uppercase' }}>{cleanLabel}</Text>
                                    {inCartCount > 0 ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 4, gap: 8, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                                                <TouchableOpacity 
                                                    onPress={() => useCartStore.getState().decrementItem(pkg.id)} 
                                                    style={{ backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                                                    <MaterialIcons name="remove" size={14} color="#fff" />
                                                </TouchableOpacity>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>{inCartCount}</Text>
                                                <TouchableOpacity 
                                                    onPress={() => useCartStore.getState().addItem({ menu_item_id: pkg.id, name: cleanLabel, price: pkg.price, quantity: 1, is_package: true })} 
                                                    style={{ backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                                                    <MaterialIcons name="add" size={14} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => router.push("/(tabs)/cart")}
                                                style={{ backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>ONAYLA</Text>
                                                <MaterialIcons name="chevron-right" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity 
                                            onPress={() => {
                                                if (cartItemCount > 0 && orderMode !== 'eat_now' && orderMode !== null) {
                                                    Alert.alert("Sepet Sıfırlanacak", "Farklı modda ürünleriniz var, sepet boşaltılsın mı?", [
                                                        { text: "Vazgeç" },
                                                        { text: "Boşalt", style: "destructive", onPress: () => {
                                                            useCartStore.getState().clearCart();
                                                            setOrderMode('eat_now');
                                                            useCartStore.getState().addItem({ menu_item_id: pkg.id, name: cleanLabel, price: pkg.price, quantity: 1, is_package: true });
                                                        }}
                                                    ]);
                                                } else {
                                                    setOrderMode('eat_now');
                                                    useCartStore.getState().addItem({ menu_item_id: pkg.id, name: cleanLabel, price: pkg.price, quantity: 1, is_package: true });
                                                    Alert.alert("Eklendi", `${cleanLabel} sepete eklendi.`);
                                                }
                                            }}
                                            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>EKLE & YE</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    );
                })}
             </View>
          </View>
        )}



        {/* Balance Card for Individual Accounts */}
        {!isCompany && (
          <View style={[styles.balanceCard, { marginTop: 16, marginBottom: 32 }]}>
            <MaterialIcons name="account-balance-wallet" size={120} color={colors.text === '#f8fafc' ? 'rgba(6, 78, 59, 0.05)' : 'rgba(255,255,255,0.03)'} style={styles.balanceBgIcon} />
            <Text style={styles.balanceLabel}>GÜNCEL BORÇ DURUMU</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceCurrency}>₺</Text>
              <Text style={styles.balanceValue}>{currentDebt.toLocaleString("tr-TR")}</Text>
            </View>
            
            <View style={styles.balanceDivider} />
            
            <View style={styles.balanceFooter}>
              <View>
                <Text style={styles.lastPaymentText}>Ödenmemiş Siparişler</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text === '#f8fafc' ? '#064e3b' : '#fff', opacity: 0.9, marginTop: 4 }}>
                  {filteredUnpaidOrders.length} Adet Sipariş
                </Text>
              </View>
              {currentDebt > 0 && (
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={generatePdf}
                  style={{ backgroundColor: colors.text === '#f8fafc' ? '#064e3b' : '#334155', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="picture-as-pdf" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Döküm</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Borç Detayı Modalı Kaldırıldı */}
    </SafeAreaView>
  );
}

const ActionCard = ({ icon, title, subtitle, bgColor, onPress, isDisabled = false }: any) => {
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  return (
    <TouchableOpacity 
      style={[
        stylesBase.actionCard, 
        { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
        isDisabled && { opacity: 0.4 }
      ]} 
      activeOpacity={isDisabled ? 1 : 0.8} 
      onPress={onPress}
    >
      <View style={[stylesBase.actionIconBox, { backgroundColor: bgColor }]}>
        <MaterialIcons name={icon} size={20} color="#fff" />
      </View>
      <View style={stylesBase.actionTexts}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[stylesBase.actionTitle, { color: colors.text }]}>{title}</Text>
          {isDisabled && <MaterialIcons name="lock" size={12} color={colors.muted} style={{ marginLeft: 4 }} />}
        </View>
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


