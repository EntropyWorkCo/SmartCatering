import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { adisyonService } from "@/lib/services/adisyonService";
import { billingService } from "@/lib/services/billingService";
import { pricingService } from "@/lib/services/pricingService";
import { userService } from "@/lib/services/userService";
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

import PreviewModalBody from './PreviewModalBody';

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

  // Parçalı Ödeme Modalı State
  const [partialModalVisible, setPartialModalVisible] = useState(false);
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fiyat Ayarlama Modalı State
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [priceCompany, setPriceCompany] = useState<any | null>(null);
  const [priceInputs, setPriceInputs] = useState<{ two: string; three: string; four: string }>({ two: '', three: '', four: '' });
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  // Bu Ayı Hesapla Modalı State
  const [calcModalVisible, setCalcModalVisible] = useState(false);
  const [calcAccount, setCalcAccount] = useState<any | null>(null);
  const [calcResult, setCalcResult] = useState<{ total: number; breakdown: { selectionCount: number; count: number; unitPrice: number; subtotal: number }[] } | null>(null);
  const [calculatingMonth, setCalculatingMonth] = useState(false);
  const [confirmingCalc, setConfirmingCalc] = useState(false);

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

  // PreviewAccount için türetilmiş veriler
  const previewData = useMemo(() => {
    if (!previewAccount) return null;
    const allOrders: any[] = previewAccount.orders || [];
    const mealOrders = allOrders.filter((o: any) =>
      o.order_type === 'Şimdi Ye' || o.order_type === 'Sipariş Ver'
    );
    const financialEntries = allOrders
      .filter((o: any) => o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const closings = financialEntries.filter((e: any) => (e.note || '').includes('Ay Kapanışı'));
    const lastClosingTime: number | null = closings.length ? new Date(closings[0].created_at).getTime() : null;

    // Son ödeme zamanı (en yeni MANUAL_PAYMENT)
    const lastPaymentEntry = financialEntries.find((e: any) => e.order_type === 'MANUAL_PAYMENT');
    const lastPaymentTime: number | null = lastPaymentEntry ? new Date(lastPaymentEntry.created_at).getTime() : null;

    const byDay: Record<string, { dateKey: string; date: Date; dayOrders: any[] }> = {};
    mealOrders.forEach((o: any) => {
      const d = new Date(o.created_at);
      const key = d.toISOString().split('T')[0];
      if (!byDay[key]) byDay[key] = { dateKey: key, date: d, dayOrders: [] };
      const dTime = d.getTime();

      // isPaid öncelik sırası — her zaman explicit ödeme/kapanış kanıtı aranır:
      // 1. Ay kapanışı kaydı varsa → kapanış tarihinden önceki siparişler ödendi
      // 2. Ödeme (MANUAL_PAYMENT) kaydı varsa → son ödeme tarihinden önceki siparişler ödendi
      // 3. Siparişin kendi status alanı (legacy)
      // NOT: Bakiye=0 tek başına "ödendi" saymaz — ödeme kaydı olmadan yeni siparişler hâlâ açık kalır
      const isPaid = lastClosingTime !== null
        ? dTime < lastClosingTime
        : lastPaymentTime !== null
          ? dTime < lastPaymentTime
          : ['PAID', 'ÖDENDİ', 'COMPLETED', 'TAMAMLANDI'].includes((o.status || '').toUpperCase());

      byDay[key].dayOrders.push({ ...o, isPaid });
    });
    const mealDays = Object.values(byDay).sort((a, b) => b.date.getTime() - a.date.getTime());
    const debtAmount: number = previewAccount.isCorporate ? previewAccount.manualDebt : previewAccount.total;
    const hasDebt = debtAmount !== 0;
    const debtPositive = debtAmount > 0;
    const hasMeals = mealDays.length !== 0;
    const hasFinancial = financialEntries.length !== 0;
    const isEmpty = !hasMeals && !hasFinancial;
    const totalPlates = mealDays.reduce((s: number, d: any) => s + (d.dayOrders as any[]).length, 0);
    const debtColor = debtPositive ? '#ef4444' : '#16a34a';
    const debtLabel = debtPositive ? `₺${debtAmount.toLocaleString('tr-TR')}` : 'Temiz';

    // Finansal satırlar için hazırlanmış veri
    const financialRows = financialEntries.map((entry: any, idx: number) => {
      const isPayment = entry.order_type === 'MANUAL_PAYMENT';
      const isClosing = (entry.note || '').includes('Ay Kapanışı');
      const label = isPayment ? 'Kısmi Ödeme' : isClosing ? 'Ay Kapanışı' : 'Borç Girişi';
      const badgeKey = isPayment ? 'payment' : isClosing ? 'closing' : 'open';
      const badgeLabel = isPayment ? 'İşlendi' : isClosing ? 'Kapandı' : 'Açık';
      const badgeColor = isPayment ? '#3B6D11' : isClosing ? '#185FA5' : '#854F0B';
      const amountColor = isPayment ? '#16a34a' : '#111827';
      const amountSign = isPayment ? '-' : '+';
      const hasAmount = entry.total_amount > 0;
      const amountStr = hasAmount ? `${amountSign}₺${entry.total_amount.toLocaleString('tr-TR')}` : '';
      const notLast = idx !== financialEntries.length - 1;
      return { ...entry, label, badgeKey, badgeLabel, badgeColor, amountColor, amountStr, hasAmount, notLast };
    });

    // Yemek günleri için hazırlanmış veri
    const mealDaysEnriched = mealDays.map((dayObj: any) => ({
      ...dayObj,
      dayOrdersEnriched: (dayObj.dayOrders as any[]).map((order: any) => {
        const items: any[] = order.adisyon_items || [];

        // 1. selections dolu olan tabldot kalemi (menu ekranı)
        const tabldotItem = items.find((i: any) => Array.isArray(i.selections) && i.selections.length);

        // 2. Fallback: selections null ama menu_items.name'den TABLDOT anlaşılan (home ekranı)
        const packageFallback = !tabldotItem
          ? items.find((i: any) => {
              const cat: string = i.menu_items?.category || '';
              const nm: string = i.menu_items?.name || '';
              return cat === 'TABLDOT' || nm.toUpperCase().includes('TABLDOT') || nm.toUpperCase().includes('PAKET');
            })
          : null;

        let selectionCount: number = tabldotItem?.selections?.length || 0;
        const mealContents: string[] = tabldotItem?.selections?.map((s: any) => s.item_name).filter(Boolean) || [];

        if (selectionCount === 0 && packageFallback) {
          const nm: string = packageFallback.menu_items?.name || '';
          if (nm.includes('2') || nm.toUpperCase().includes('2 ÇEŞİT')) selectionCount = 2;
          else if (nm.includes('3') || nm.toUpperCase().includes('3 ÇEŞİT')) selectionCount = 3;
          else selectionCount = 4;
        }

        const hasSelections = selectionCount !== 0;
        const activeTabldotItem = tabldotItem || packageFallback;
        const tabldotQuantity: number = activeTabldotItem?.quantity || 1;
        const otherItems = items.filter((i: any) => i !== activeTabldotItem);
        const hasOtherItems = otherItems.length !== 0;
        const initials = (order.userName || 'M').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
        const tabldotLabel = `${selectionCount}'lü Tabldot`;
        return { ...order, selectionCount, hasSelections, mealContents, otherItems, hasOtherItems, initials, tabldotLabel, tabldotQuantity };
      }),
    }));

    return {
      mealDays, financialEntries, debtAmount, hasDebt, debtPositive, hasMeals, hasFinancial,
      isEmpty, totalPlates, debtColor, debtLabel, financialRows, mealDaysEnriched,
    };
  }, [previewAccount]);

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

        const isActuallyCorporate = !!finalCompanyName || order.isCorporate === true;

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
           if (order.order_type === 'MANUAL_PAYMENT') {
             map[key].total -= (order.total_amount || 0);
           } else {
             map[key].total += order.total_amount || 0;
           }
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

  // ── Ay Kapanışı (Admin) ─────────────────────────────────────
  const [closingMonth, setClosingMonth] = useState(false);

  const handleCloseMonthAdmin = async (account: any) => {
    if (!account.companyId) {
      Alert.alert('Hata', 'Bu hesap için firma ID bulunamadı.');
      return;
    }
    const now = new Date();
    const monthName = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    Alert.alert(
      'Ay Kapanışını Onayla',
      `${account.displayName} — ${monthName}\n\nBu işlem:\n• Tüm ödenmemiş siparişleri "Ödendi" işaretler\n• Şirket bakiyesini sıfırlar\n• Geri alınamaz`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: 'destructive',
          onPress: async () => {
            setClosingMonth(true);
            try {
              const empList = await userService.getCompanyEmployees(account.companyId);
              const empIds = empList.map((e: any) => e.id).filter(Boolean);
              await billingService.closeMonth(account.companyId, account.userId, empIds);
              if (fetchOrders) await fetchOrders();
              Alert.alert('✅ Tamamlandı', `${account.displayName} — ${monthName} ay kapanışı tamamlandı.`);
            } catch (err: any) {
              Alert.alert('Hata', 'Ay kapanışı yapılamadı: ' + (err.message || 'Bilinmeyen hata'));
            } finally {
              setClosingMonth(false);
            }
          }
        }
      ]
    );
  };

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

  const handlePartialPayment = async () => {
    if (!selectedAccountForPayment || !paymentAmount) return;
    setUpdatingDebt(true);
    try {
      const amount = Number(paymentAmount);
      await billingService.recordPayment(
        selectedAccountForPayment.userId,
        selectedAccountForPayment.companyId || null,
        amount,
        paymentMethod,
        "Parçalı Ödeme"
      );

      Alert.alert("Başarılı", "Ödeme başarıyla kaydedildi.");
      
      // Update local state for immediate UI feedback
      if (selectedAccountForPayment.isCorporate && selectedAccountForPayment.companyId) {
        setCompanies(prev => prev.map(c => 
          c.id === selectedAccountForPayment.companyId ? { ...c, balance: Math.max(0, (c.balance || 0) - amount) } : c
        ));
      } else {
        await fetchOrders();
      }

      setPartialModalVisible(false);
      setPaymentAmount("");
    } catch (err: any) {
      Alert.alert("Hata", "Ödeme kaydedilirken hata oluştu: " + err.message);
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

  const handleCalculateMonth = async (account: any) => {
    if (!account.companyId) {
      Alert.alert('Hata', 'Bu hesap için firma ID bulunamadı.');
      return;
    }
    setCalcAccount(account);
    setCalcResult(null);
    setCalcModalVisible(true);
    setCalculatingMonth(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Firma sahibi + çalışanların user_id'lerini bul
      const { data: employees } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', account.companyId);

      const userIds = [
        account.userId,
        ...((employees || []).map((u: any) => u.id)),
      ].filter((id, idx, arr) => !!id && arr.indexOf(id) === idx);

      // Bu ay bu kullanıcıların yemek siparişlerini DB'den direkt çek
      // selections explicit seçiliyor — account.orders'a güvenmiyoruz
      const { data: monthOrders, error } = await supabase
        .from('adisyon')
        .select('id, order_type, created_at, adisyon_items(id, selections, menu_items(id, name, category))')
        .in('user_id', userIds)
        .in('order_type', ['Şimdi Ye', 'Sipariş Ver'])
        .gte('created_at', monthStart.toISOString());

      if (error) throw error;

      const result = await pricingService.calculateMonthlyTotal(
        account.companyId,
        monthOrders || []
      );
      setCalcResult(result);
    } catch {
      Alert.alert('Hata', 'Hesaplama yapılırken hata oluştu.');
      setCalcModalVisible(false);
    } finally {
      setCalculatingMonth(false);
    }
  };

  const handleConfirmCalc = async () => {
    if (!calcAccount || !calcResult) return;
    setConfirmingCalc(true);
    try {
      const todayStr = new Date().toLocaleDateString('tr-TR');
      await billingService.addManualEntry(
        calcAccount.userId,
        calcResult.total,
        todayStr,
        todayStr,
        'DEBT',
        'Aylık Tabldot Hesabı'
      );
      const updatedBalance = (calcAccount.manualDebt || 0) + calcResult.total;
      await billingService.updateCompanyBalance(calcAccount.companyId, updatedBalance);
      setCompanies((prev) => prev.map((c) =>
        c.id === calcAccount.companyId ? { ...c, balance: updatedBalance } : c
      ));
      Alert.alert('Başarılı', `₺${calcResult.total.toLocaleString('tr-TR')} borç olarak eklendi.`);
      setCalcModalVisible(false);
      setCalcResult(null);
    } catch {
      Alert.alert('Hata', 'Borç kaydedilirken hata oluştu.');
    } finally {
      setConfirmingCalc(false);
    }
  };

  const handleOpenPriceModal = async (account: any) => {
    if (!account.companyId) {
      Alert.alert('Hata', 'Bu hesap için firma ID bulunamadı.');
      return;
    }
    setPriceCompany(account);
    setPriceModalVisible(true);
    setLoadingPrices(true);
    try {
      const prices = await pricingService.getCompanyPrices(account.companyId);
      const map: Record<number, string> = {};
      prices.forEach((p) => { map[p.selection_count] = p.unit_price.toString(); });
      setPriceInputs({
        two: map[2] || '',
        three: map[3] || '',
        four: map[4] || '',
      });
    } catch {
      Alert.alert('Hata', 'Fiyatlar yüklenirken hata oluştu.');
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleSavePrices = async () => {
    if (!priceCompany) return;
    setSavingPrices(true);
    try {
      await pricingService.setPrices(priceCompany.companyId, [
        { selectionCount: 2, unitPrice: parseFloat(priceInputs.two) || 0 },
        { selectionCount: 3, unitPrice: parseFloat(priceInputs.three) || 0 },
        { selectionCount: 4, unitPrice: parseFloat(priceInputs.four) || 0 },
      ]);
      Alert.alert('Başarılı', 'Fiyatlar kaydedildi.');
      setPriceModalVisible(false);
    } catch {
      Alert.alert('Hata', 'Fiyatlar kaydedilirken hata oluştu.');
    } finally {
      setSavingPrices(false);
    }
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

        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 24, marginBottom: 12 }}>{mainTab === 'KURUMSAL' ? 'FİRMA & BORÇ LİSTESİ' : 'MÜŞTERİ & BORÇ LİSTESİ'}</Text>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, marginTop: 12, fontSize: 12, fontWeight: '700' }}>Veriler Yükleniyor...</Text>
          </View>
        ) : groupedAccounts.map((account) => (
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
              {account.isCorporate ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity style={styles.sqBtn} onPress={() => setPreviewAccount(account)}>
                    <MaterialIcons name="receipt-long" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Döküm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#2196F3' }]} onPress={() => { setSelectedCompanyId(account.companyId || ''); setNewDebtAmount(''); setDebtModalVisible(true); }}>
                    <MaterialIcons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Borç Gir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#FF9800' }]} onPress={() => { setSelectedAccountForPayment(account); setPaymentAmount(''); setPartialModalVisible(true); }}>
                    <MaterialIcons name="payments" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Ödeme</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#6366f1' }]} onPress={() => handleCloseMonthAdmin(account)} disabled={closingMonth}>
                    {closingMonth ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="event-available" size={18} color="#fff" />}
                    <Text style={styles.sqBtnText}>Ay Kapat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleCalculateMonth(account)}>
                    <MaterialIcons name="calculate" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Hesapla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#0ea5e9' }]} onPress={() => handleOpenPriceModal(account)}>
                    <MaterialIcons name="attach-money" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Fiyat</Text>
                  </TouchableOpacity>
                  {account.manualDebt > 0 && (
                    <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#4CAF50' }]} onPress={() => handleClearDebt(account)}>
                      <MaterialIcons name="check-circle-outline" size={18} color="#fff" />
                      <Text style={styles.sqBtnText}>Ödendi</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity style={styles.sqBtn} onPress={() => setPreviewAccount(account)}>
                    <MaterialIcons name="receipt-long" size={18} color="#fff" />
                    <Text style={styles.sqBtnText}>Döküm</Text>
                  </TouchableOpacity>
                  {account.total > 0 && (
                    <>
                      <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#FF9800' }]} onPress={() => { setSelectedAccountForPayment(account); setPaymentAmount(''); setPartialModalVisible(true); }}>
                        <MaterialIcons name="payments" size={18} color="#fff" />
                        <Text style={styles.sqBtnText}>Ödeme</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.sqBtn, { backgroundColor: '#4CAF50' }]} onPress={() => handleClearDebt(account)}>
                        <MaterialIcons name="check-circle-outline" size={18} color="#fff" />
                        <Text style={styles.sqBtnText}>Ödendi</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
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
      <Modal visible={!!previewAccount} transparent={false} animationType="slide">
        <View style={[styles.invoiceModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.invoiceHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.invoiceMetaLabel, { color: colors.muted }]}>{previewAccount?.isCorporate ? 'FİRMA' : 'MÜŞTERİ'}</Text>
              <Text style={[styles.invoiceTitle, { color: colors.text }]} numberOfLines={1}>{previewAccount?.displayName}</Text>
            </View>
            <TouchableOpacity onPress={() => setPreviewAccount(null)} style={styles.invoiceCloseBtn}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <TouchableOpacity style={styles.pdfBtn} onPress={() => handleExportPDF(previewAccount)}>
              <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>PDF Ekstre İndir</Text>
            </TouchableOpacity>
            <PreviewModalBody previewData={previewData} colors={colors} styles={styles} />
          </ScrollView>
        </View>
      </Modal>

      {/* Parçalı Ödeme Modalı */}
      <Modal visible={partialModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Parçalı Ödeme Al</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: 'bold' }}>ÖDEME TUTARI (₺)</Text>
              <TextInput
                style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder, marginBottom: 16 }]}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setPartialModalVisible(false)}>
                  <Text style={{ color: colors.muted }}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handlePartialPayment} disabled={updatingDebt}>
                  {updatingDebt ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ödemeyi Kaydet</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bu Ayı Hesapla Modalı */}
      <Modal visible={calcModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Hesabı
            </Text>
            {calcAccount ? (
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>{calcAccount.displayName}</Text>
            ) : null}

            {calculatingMonth ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : calcResult ? (
              <View style={{ marginBottom: 20 }}>
                {calcResult.breakdown.filter((b) => b.count !== 0).map((b) => (
                  <View key={b.selectionCount} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.surfaceBorder }}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{b.selectionCount}{"'"}lü Tabldot</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{b.count} tabak × ₺{b.unitPrice.toLocaleString('tr-TR')}</Text>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>₺{b.subtotal.toLocaleString('tr-TR')}</Text>
                  </View>
                ))}
                {calcResult.breakdown.every((b) => b.count === 0) ? (
                  <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 16 }}>Bu dönemde açık tabldot siparişi yok.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>TOPLAM</Text>
                    <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20 }}>₺{calcResult.total.toLocaleString('tr-TR')}</Text>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setCalcModalVisible(false); setCalcResult(null); }}>
                <Text style={{ color: colors.muted }}>İptal</Text>
              </TouchableOpacity>
              {calcResult && calcResult.total !== 0 ? (
                <TouchableOpacity style={styles.modalConfirm} onPress={handleConfirmCalc} disabled={confirmingCalc}>
                  {confirmingCalc ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Borç Olarak Ekle</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Fiyat Ayarlama Modalı */}
      <Modal visible={priceModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Tabldot Fiyatları</Text>
              {priceCompany ? (
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>{priceCompany.displayName}</Text>
              ) : null}
              {loadingPrices ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />
              ) : (
                <View style={{ gap: 12, marginBottom: 20 }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{"2'Lİ TABLDOT (₺/TABAK)"}</Text>
                    <TextInput
                      style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder, marginBottom: 0 }]}
                      keyboardType="numeric"
                      value={priceInputs.two}
                      onChangeText={(v) => setPriceInputs((prev) => ({ ...prev, two: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{"3'LÜ TABLDOT (₺/TABAK)"}</Text>
                    <TextInput
                      style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder, marginBottom: 0 }]}
                      keyboardType="numeric"
                      value={priceInputs.three}
                      onChangeText={(v) => setPriceInputs((prev) => ({ ...prev, three: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{"4'LÜ TABLDOT (₺/TABAK)"}</Text>
                    <TextInput
                      style={[styles.debtInput, { color: colors.text, borderColor: colors.surfaceBorder, marginBottom: 0 }]}
                      keyboardType="numeric"
                      value={priceInputs.four}
                      onChangeText={(v) => setPriceInputs((prev) => ({ ...prev, four: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setPriceModalVisible(false)}>
                  <Text style={{ color: colors.muted }}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleSavePrices} disabled={savingPrices || loadingPrices}>
                  {savingPrices ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kaydet</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  accountTextCont: {},
  accountName: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  accountBalance: { fontSize: 12, color: colors.muted },
  accountActions: { flexDirection: 'row', gap: 12 },
  outlineBtn: { flex: 1, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
  outlineBtnText: { fontSize: 12, fontWeight: 'bold', color: colors.text },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  sqBtn: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sqBtnText: { fontSize: 10, fontWeight: '700', color: '#fff', textAlign: 'center' },
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
  invoiceTotalValue: { fontSize: 24, fontWeight: '900' },
  previewStatCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  previewStatLabel: { fontSize: 10, fontWeight: '700', color: '#6b7280', marginBottom: 4, letterSpacing: 0.5 },
  previewStatValue: { fontSize: 20, fontWeight: '900', color: '#111827' },
  previewSectionLabel: { fontSize: 10, fontWeight: '900', color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  previewDayBlock: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  previewDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f9fafb' },
  previewDayDate: { fontSize: 13, fontWeight: '700', color: '#374151' },
  previewPersonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: '#f3f4f6' },
  previewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  previewAvatarText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  previewPersonName: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4 },
  previewTabldotTag: { alignSelf: 'flex-start', backgroundColor: '#f0fdf4', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 4 },
  previewTabldotTagText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  previewMealChip: { backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  previewMealChipText: { fontSize: 11, color: '#374151' },
  previewOtherItem: { fontSize: 12, color: '#6b7280' },
  previewBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  previewBadgeText: { fontSize: 10, fontWeight: '700' },
  previewBadgeOpen: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  previewBadgePaid: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  previewBadgePayment: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  previewBadgeClosing: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  previewFinanceCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 16 },
  previewFinanceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  previewFinanceDate: { fontSize: 11, color: '#6b7280', width: 60 },
  previewFinanceLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  previewFinanceNote: { fontSize: 11, color: '#6b7280' },
  previewFinanceAmount: { fontSize: 13, fontWeight: '700' },
});
