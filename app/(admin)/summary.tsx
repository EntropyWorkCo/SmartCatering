import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { adisyonService } from "@/lib/services/adisyonService";
import { billingService } from "@/lib/services/billingService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    RefreshControl
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SummaryScreen() {
  const { orders, loading, updateOrderStatus, fetchOrders } = useAdisyon();
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const colors = Colors[theme];
  const styles = getStyles(colors);
  const router = useRouter();

  const [ratings, setRatings] = useState<any[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(true);

  // Borç Düzenleme Modalı State
  const [debtModalVisible, setDebtModalVisible] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [updatingDebt, setUpdatingDebt] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    if (fetchOrders) await fetchOrders();
    setRefreshTrigger(prev => prev + 1);
    setRefreshing(false);
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      const fetchRatings = async () => {
        const { data, error } = await supabase
          .from("feedbacks")
          .select("*, users!feedbacks_user_id_fkey(full_name, companies!companies_user_id_fkey(company_name))");
        if (data) setRatings(data);
        setLoadingRatings(false);
      };
      
      const fetchCompanies = async () => {
        const { data } = await supabase
          .from("companies")
          .select("*");
        if (data) setCompanies(data);
      };

      fetchRatings();
      fetchCompanies();
    }, [refreshTrigger])
  );

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return "0.0";
    const sum = ratings.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    return (sum / ratings.length).toFixed(1);
  }, [ratings]);

  const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL");
  const [previewAccount, setPreviewAccount] = useState<any | null>(null);

  const groupedAccounts = useMemo(() => {
    try {
      const map: Record<
        string,
        {
          userId: string;
          companyId?: string;
          name: string;
          isCorporate: boolean;
          displayName: string;
          total: number;
          manualDebt: number;
          count: number;
          orders: any[];
        }
      > = {};

      // KURUMSAL sekmesinde tüm kayıtlı şirketleri önceden listeye ekle
      if (mainTab === "KURUMSAL") {
        companies.forEach(company => {
          map[company.company_name] = {
            userId: company.user_id || "",
            companyId: company.id,
            name: "Firma Sahibi",
            isCorporate: true,
            displayName: company.company_name,
            total: 0,
            manualDebt: company.balance || 0,
            count: 0,
            orders: [],
          };
        });
      }

      const safeOrders = orders || [];

      safeOrders.forEach((order) => {
        // Find if user is a company owner locally
        const ownedCompany = companies.find(c => c.user_id === order.user_id);
        
        let finalCompanyName = order.companyName;
        let finalCompanyId = order.companyId;
        let finalManualDebt = order.companies?.balance || 0;
        
        // If owner, override company info
        if (ownedCompany) {
            finalCompanyName = ownedCompany.company_name;
            finalCompanyId = ownedCompany.id;
            finalManualDebt = ownedCompany.balance || 0;
        }

        const isActuallyCorporate = !!finalCompanyName;

        const match =
          (mainTab === "KURUMSAL" && isActuallyCorporate) ||
          (mainTab === "BIREYSEL" && !isActuallyCorporate);

        if (!match) return;

        const key = isActuallyCorporate
          ? finalCompanyName
          : order.user_id;

        if (!map[key]) {
          map[key] = {
            userId: order.user_id,
            companyId: finalCompanyId,
            name: order.userName || "Bilinmeyen Müşteri",
            isCorporate: isActuallyCorporate,
            displayName: isActuallyCorporate
              ? finalCompanyName
              : order.userName || "Bireysel Müşteri",
            total: 0,
            manualDebt: finalManualDebt,
            count: 0,
            orders: [],
          };
        }

        // Bireysel ise sipariş toplamlarını ekle, kurumsal ise adminin girdiği balance'ı göstereceğiz
        const statusUpper = (order.status || "").toUpperCase();
        if (!["CANCELLED", "İPTAL", "PAID", "ÖDENDI", "ÖDENDİ"].includes(statusUpper)) {
           map[key].total += order.total_amount || 0;
        }
        
        map[key].count += 1;
        map[key].orders.push(order);
      });

      return Object.values(map).sort((a, b) => b.total - a.total);
    } catch (e) {
      console.error("Gruplama hatası:", e);
      return [];
    }
  }, [orders, mainTab, companies]);

  const totalDebt = useMemo(
    () => groupedAccounts.reduce((acc, curr) => acc + (curr.isCorporate ? curr.manualDebt : curr.total), 0),
    [groupedAccounts]
  );

  const handleUpdateDebt = async () => {
    if (!selectedCompanyId || !newDebtAmount) return;
    setUpdatingDebt(true);
    try {
      const company = companies.find(c => c.id === selectedCompanyId);
      if (!company) throw new Error("Firma bulunamadı");
      // 1. Manuel Adisyon Kaydı Oluştur (Arşiv için)
      await billingService.addManualEntry(
        company.user_id, 
        Number(newDebtAmount), 
        startDate.toLocaleDateString('tr-TR'), 
        endDate.toLocaleDateString('tr-TR'), 
        'DEBT'
      );

      // 2. Şirket Bakiyesini Güncelle (Hızlı toplam için)
      const currentBalance = company.balance || 0;
      const amount = Number(newDebtAmount);
      const updatedBalance = currentBalance + amount;

      await billingService.updateCompanyBalance(selectedCompanyId, updatedBalance);
      
      Alert.alert("Başarılı", "Borç kaydı eklendi.");
      
      setCompanies(prev => prev.map(c => 
        c.id === selectedCompanyId ? { ...c, balance: updatedBalance } : c
      ));
      
      setDebtModalVisible(false);
      setNewDebtAmount("");
    } catch (err: any) {
      Alert.alert("Hata", "İşlem yapılırken hata oluştu: " + err.message);
    } finally {
      setUpdatingDebt(false);
    }
  };

  const handleClearDebt = (account: any) => {
    Alert.alert(
      "Borç Sıfırlama",
      "Bu müşterinin/firmanın borcunu sıfırlayıp ödendi olarak işaretlemek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Evet, Sıfırla", 
          style: "destructive",
          onPress: async () => {
             setUpdatingDebt(true);
             try {
              if (account.isCorporate && account.companyId) {
                const currentDate = new Date().toLocaleDateString('tr-TR');
                await billingService.addManualEntry(
                  account.userId, 
                  account.manualDebt, 
                  currentDate, 
                  currentDate, 
                  'PAYMENT'
                );

                await billingService.clearCompanyBalance(account.companyId);
                setCompanies(prev => prev.map(c => c.id === account.companyId ? { ...c, balance: 0 } : c));
              } else if (account.userId) {
                 await adisyonService.clearUserDebt(account.userId);
                 await fetchOrders();
               }
               Alert.alert("Başarılı", "Borç sıfırlandı ve ödendi olarak işaretlendi.");
             } catch (err: any) {
               Alert.alert("Hata", "Borç sıfırlanırken hata oluştu: " + err.message);
             } finally {
               setUpdatingDebt(false);
             }
          }
        }
      ]
    );
  };

  const handleExportPDF = async (account: any) => {
    try {
      const dateStr = new Date().toLocaleDateString('tr-TR');
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
              .brand { color: ${colors.primary}; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -1px; }
              .report-type { margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold; }
              .meta-right { text-align: right; }
              .meta-text { font-size: 12px; color: #64748b; }
              .meta-text strong { color: #1e293b; }
              .account-info { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
              .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
              .info-value { font-size: 18px; font-weight: bold; color: #1e293b; }
              .section-title { font-size: 12px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 30px 0 15px 0; }
              table { width: 100%; border-collapse: collapse; }
              th { text-align: left; font-size: 10px; color: #64748b; padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
              td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
              .total-box { margin-top: 40px; padding: 25px; border-radius: 16px; background: ${colors.primary}08; border: 1px solid ${colors.primary}15; display: flex; justify-content: space-between; align-items: center; }
              .total-label { font-size: 14px; font-weight: bold; color: #1e293b; }
              .total-value { font-size: 28px; font-weight: 900; color: ${colors.primary}; }
              .manual-note { margin-top: 5px; font-size: 12px; color: #ef4444; font-weight: bold; }
              .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div style="background: ${colors.primary}; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-style: italic; display: inline-block; font-size: 20px; margin-bottom: 8px;">MEYDAN LOKANTA</div>
                <p class="report-type">Hizmet Detay & Borç Ekstresi</p>
              </div>
              <div class="meta-right">
                <div class="meta-text">Tarih: <strong>${dateStr}</strong></div>
              </div>
            </div>

            <div class="account-info">
              <div class="info-label">Müşteri / Firma Bilgisi</div>
              <div class="info-value">${account.displayName}</div>
            </div>

            <h2 class="section-title">Hizmet ve İşlem Detayları</h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 100px;">Tarih</th>
                  <th>Hizmet / Sipariş Detayı</th>
                  <th style="width: 120px; text-align: center;">Durum</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  // 1. Manuel borç/ödeme kayıtlarını ve personelin yediği tüm siparişleri kapsa
                  const filteredOrders = account.orders.filter((o: any) => {
                    const note = (o.note || "").toUpperCase();
                    return !note.includes("BORCA AKTARILDI");
                  });

                  // 2. Birleştirilmiş Row Listesi (Tarih bazlı sıralama için)
                  const unifiedEntries: any[] = [];
                  const groupedMap: { [key: string]: any } = {};

                  filteredOrders.forEach((o: any) => {
                    const isManual = o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT';
                    
                    if (isManual) {
                        unifiedEntries.push({
                            type: 'manual',
                            date: new Date(o.created_at),
                            order: o
                        });
                        return;
                    }

                    const dateKey = new Date(o.created_at).toLocaleDateString('tr-TR');
                    const userKey = o.userName || 'Personel';
                    const key = `${dateKey}_${userKey}`;

                    if (!groupedMap[key]) {
                      groupedMap[key] = { ...o, count: 1, items: [...(o.adisyon_items || [])] };
                    } else {
                      groupedMap[key].count += 1;
                      if (o.adisyon_items) groupedMap[key].items.push(...o.adisyon_items);
                    }
                  });

                  // Gruplanmış siparişleri listeye ekle
                  Object.values(groupedMap).forEach((o: any) => {
                    unifiedEntries.push({
                        type: 'order',
                        date: new Date(o.created_at),
                        order: o
                    });
                  });

                  // 3. TARİH SIRASINA GÖRE DİZ (Yeniden Eskiye)
                  unifiedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

                  // 4. AKILLI BAKİYE TAKİBİ (Waterfall Logic)
                  let remainingBalance = account.isCorporate ? account.manualDebt : account.total;

                  // 5. HTML Satırlarını Oluştur
                  return unifiedEntries.map((entry) => {
                    const { type, order: o } = entry;
                    const dateStr = entry.date.toLocaleDateString('tr-TR');

                    if (type === 'manual') {
                        const isDebt = o.order_type === 'MANUAL_DEBT';
                        
                        // Eğer bu bir borç girişiyse ve hala bir bakiye varsa "AÇIK", bakiye bitmişse "KAPALI"
                        let statusColor = '#22c55e'; // Varsayılan: Ödendi (Yeşil)
                        let statusLabel = 'ÖDENDİ / KAPALI';
                        let labelColor = '#64748b';

                        if (isDebt) {
                            if (remainingBalance > 0) {
                                statusColor = '#f97316'; // Borç (Turuncu)
                                statusLabel = 'BORÇ / AÇIK';
                                labelColor = '#f97316';
                                remainingBalance -= (o.total_amount || 0); // Bakiyeden düş
                            } else {
                                // Borç kaydı ama kümülatif bakiye zaten dolmuş (yani ödenmiş)
                                statusColor = '#10b981';
                                statusLabel = 'ÖDENDİ / KAPALI';
                                labelColor = '#64748b';
                            }
                        } else {
                            // Ödeme Kaydı
                            statusColor = '#10b981';
                            statusLabel = 'ÖDEME İŞLENDİ';
                            labelColor = '#22c55e';
                        }

                        const labelText = isDebt ? `BORÇ GİRİŞİ: ${o.note || '-'}` : `ÖDEME ALINDI: ${o.note || '-'}`;

                        return `
                          <tr>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size:11px;">${dateStr}</td>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size:11px;">
                                <strong style="color: ${labelColor};">${labelText}</strong><br/>
                                <small style="color:#64748b;">Kayıt Tutarı: ₺${o.total_amount?.toLocaleString('tr-TR')}</small>
                            </td>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: ${statusColor}; font-weight: bold; font-size:10px;">${statusLabel}</td>
                          </tr>
                        `;
                    } else {
                        const statusUpper = (o.status || "").toUpperCase();
                        const isCancelled = ["CANCELLED", "İPTAL"].includes(statusUpper);
                        
                        const adisyonDetay = (o.items || []).map((i: any) => {
                            const name = i.menu_items?.name || i.menu_item?.name || 'Ürün';
                            return `${i.quantity}x ${name}`;
                        }).filter(Boolean).join(', ');

                        return `
                          <tr>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size:11px;">${dateStr}</td>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size:11px;">
                                <strong>${o.userName || 'Personel'}</strong> ${o.count > 1 ? `<span style="color:${colors.primary}; font-weight:bold;">(x${o.count})</span>` : ''}<br/>
                                <small style="color:#64748b;">${adisyonDetay || 'Yemek Siparişi'}</small>
                            </td>
                            <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: ${isCancelled ? '#ef4444' : '#64748b'}; font-weight: bold; font-size:10px;">
                              ${isCancelled ? "İPTAL" : "TAMAMLANDI"}
                            </td>
                          </tr>
                        `;
                    }
                  }).join('');
                })()}
              </tbody>
            </table>

            <div class="total-box">
              <div class="total-label">GÜNCEL TOPLAM BORÇ</div>
              <div class="total-value">
                ${(account.isCorporate ? account.manualDebt : account.total) <= 0 
                  ? '<span style="color: #10b981;">ÖDENDİ</span>' 
                  : `₺${(account.isCorporate ? account.manualDebt : account.total).toLocaleString('tr-TR')}`
                }
              </div>
            </div>

            <div class="footer">
              <p>Bu belge bilgilendirme amaçlı otomatik olarak oluşturulmuştur.</p>
              &copy; ${new Date().getFullYear()} Meydan Lokanta | Yönetim Paneli
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
    }
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Özet & Borçlar</Text>
        </View>
        <ThemeSwitcher />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, mainTab === "KURUMSAL" && styles.activeTab]}
          onPress={() => setMainTab("KURUMSAL")}
        >
          <Text style={[styles.tabText, mainTab === "KURUMSAL" && styles.activeTabText]}>KURUMSAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === "BIREYSEL" && styles.activeTab]}
          onPress={() => setMainTab("BIREYSEL")}
        >
          <Text style={[styles.tabText, mainTab === "BIREYSEL" && styles.activeTabText]}>BİREYSEL</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} title="Yenileniyor..." titleColor={colors.text} colors={[colors.primary]} progressBackgroundColor="#ffffff" progressViewOffset={30} />}
      >
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOPLAM BEKLEYEN BORÇ</Text>
          <Text style={styles.totalAmount}>₺{totalDebt.toLocaleString("tr-TR")}</Text>
        </View>

        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 24, marginBottom: 12 }}>FİRMA & BORÇ LİSTESİ</Text>

        {groupedAccounts.map((account) => (
          <View key={account.userId} style={styles.accountCard}>
            <View style={styles.accountTop}>
              <View style={styles.accountTextCont}>
                <Text style={styles.accountName}>{account.displayName}</Text>
                <Text style={styles.accountBalance}>
                  {(() => {
                    const debtAmount = account.isCorporate ? account.manualDebt : account.total;
                    if (debtAmount <= 0) {
                      return <Text style={{ color: "#4CAF50", fontWeight: 'bold' }}>Borç Ödendi</Text>;
                    }
                    return (
                      <>
                        Güncel Borç: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>₺{debtAmount.toLocaleString("tr-TR")}</Text>
                      </>
                    );
                  })()}
                </Text>
              </View>
            </View>

            <View style={styles.accountActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setPreviewAccount(account)}>
                <Text style={styles.outlineBtnText}>Döküm İncele</Text>
              </TouchableOpacity>

              {account.isCorporate ? (
                <>
                  <TouchableOpacity 
                     style={[styles.primaryBtn, { backgroundColor: "#2196F3", marginLeft: 8 }]} 
                     onPress={() => {
                       setSelectedCompanyId(account.companyId || "");
                       setNewDebtAmount((account.manualDebt || 0).toString());
                       setDebtModalVisible(true);
                     }}
                  >
                    <Text style={styles.primaryBtnText}>Borç Gir</Text>
                  </TouchableOpacity>
                  {(account.manualDebt > 0) && (
                    <TouchableOpacity 
                       style={[styles.primaryBtn, { backgroundColor: "#4CAF50", marginLeft: 8 }]} 
                       onPress={() => handleClearDebt(account)}
                    >
                      <Text style={styles.primaryBtnText}>Borç Ödendi</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                  account.total > 0 ? (
                    <TouchableOpacity 
                       style={[styles.primaryBtn, { backgroundColor: "#4CAF50", marginLeft: 8 }]} 
                       onPress={() => handleClearDebt(account)}
                    >
                      <Text style={styles.primaryBtnText}>Borç Ödendi</Text>
                    </TouchableOpacity>
                  ) : null
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Borç Giriş Modalı */}
      <Modal visible={debtModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manuel Borç Girişi</Text>
            
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: 'bold' }}>TUTAR (₺)</Text>
            <TextInput
               style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder, marginBottom: 16 }]}
               keyboardType="numeric"
               value={newDebtAmount}
               onChangeText={setNewDebtAmount}
               placeholder="1500"
               placeholderTextColor={colors.muted}
            />

            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: 'bold' }}>TARİH ARALIĞI SEÇİN</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowStartPicker(true);
                }}
                style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>BAŞLANGIÇ TARİHİ</Text>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>{startDate.toLocaleDateString('tr-TR')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowEndPicker(true);
                }}
                style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>BİTİŞ TARİHİ</Text>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>{endDate.toLocaleDateString('tr-TR')}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false);
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false);
                  if (selectedDate) setEndDate(selectedDate);
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDebtModalVisible(false)}>
                <Text style={{ color: colors.muted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleUpdateDebt} disabled={updatingDebt}>
                {updatingDebt ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Güncelle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

      {/* Önizleme Modalı */}
      {previewAccount && (
        <Modal visible={!!previewAccount} transparent={false} animationType="slide">
          <View style={[styles.invoiceModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
             <View style={styles.invoiceHeader}>
               <Text style={[styles.invoiceTitle, { color: colors.text }]}>Sipariş Özeti</Text>
               <TouchableOpacity onPress={() => setPreviewAccount(null)} style={styles.invoiceCloseBtn}>
                 <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>Kapat</Text>
               </TouchableOpacity>
             </View>
             <ScrollView style={styles.modalBody}>
               <View style={styles.invoiceMetaGroup}>
                  <Text style={[styles.invoiceMetaLabel, { color: colors.muted }]}>MÜŞTERİ / FİRMA ÜNVANI</Text>
                  <Text style={[styles.invoiceMetaValue, { color: colors.text }]}>{previewAccount.displayName}</Text>
               </View>
               <TouchableOpacity style={styles.pdfBtn} onPress={() => handleExportPDF(previewAccount)}>
                 <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
                 <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>PDF Olarak İndir</Text>
               </TouchableOpacity>

               <View style={styles.invoiceDivider} />
               <Text style={[styles.modalSectionTitle, { color: colors.text }]}>HİZMET DÖKÜMÜ (LİSTE)</Text>
               {previewAccount.orders.map((order: any) => (
                 <View key={order.id} style={styles.simpleOrderRow}>
                   <Text style={[styles.simpleOrderDate, { color: colors.text }]}>{new Date(order.created_at).toLocaleDateString("tr-TR")}</Text>
                   {order.order_type === 'MANUAL_DEBT' ? (
                     <Text style={{ color: colors.primary, fontSize: 13, fontWeight: 'bold' }}>• Dönem Borcu ({order.note}): ₺{order.total_amount?.toLocaleString("tr-TR")}</Text>
                   ) : order.order_type === 'MANUAL_PAYMENT' ? (
                     <Text style={{ color: "#4CAF50", fontSize: 13, fontWeight: 'bold' }}>• Ödeme Alındı ({order.note}): ₺{order.total_amount?.toLocaleString("tr-TR")}</Text>
                   ) : (
                     order.adisyon_items?.map((item: any) => (
                       <Text key={item.id} style={{ color: colors.muted, fontSize: 12 }}>• {item.quantity}x {item.menu_items?.name}</Text>
                     ))
                   )}
                 </View>
               ))}
               <View style={styles.invoiceDivider} />
               <View style={styles.invoiceTotalBox}>
                 <Text style={[styles.invoiceTotalLabel, { color: colors.text }]}>GÜNCEL BORÇ</Text>
                 <Text style={[styles.invoiceTotalValue, { color: colors.primary }]}>₺{(previewAccount.isCorporate ? previewAccount.manualDebt : previewAccount.total).toLocaleString("tr-TR")}</Text>
               </View>
             </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: 16, borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  tabContainer: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 20, gap: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "bold", color: colors.muted },
  activeTabText: { color: colors.primary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  totalCard: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, marginBottom: 16 },
  totalLabel: { color: colors.muted, fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: "900" },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  miniStatCard: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  miniStatLabel: { fontSize: 10, fontWeight: 'bold', color: colors.muted, marginBottom: 4 },
  miniStatValue: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  accountCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  accountTop: { marginBottom: 12 },
  accountTextCont: {  },
  accountName: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  accountBalance: { fontSize: 12, color: colors.muted },
  accountActions: { flexDirection: 'row', gap: 12 },
  outlineBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
  outlineBtnText: { fontSize: 12, fontWeight: 'bold', color: colors.text },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  debtInput: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modalConfirm: { flex: 2, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  invoiceModalContainer: { flex: 1 },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.surfaceBorder },
  invoiceTitle: { fontSize: 18, fontWeight: 'bold' },
  invoiceCloseBtn: { padding: 8 },
  modalBody: { flex: 1, padding: 24 },
  invoiceMetaGroup: { marginBottom: 24 },
  invoiceMetaLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  invoiceMetaValue: { fontSize: 20, fontWeight: 'bold' },
  pdfBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginBottom: 24 },
  invoiceDivider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 16 },
  modalSectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
  simpleOrderRow: { marginBottom: 12 },
  simpleOrderDate: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  invoiceTotalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  invoiceTotalLabel: { fontSize: 14, fontWeight: 'bold' },
  invoiceTotalValue: { fontSize: 24, fontWeight: '900' }
});
