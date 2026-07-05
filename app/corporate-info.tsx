import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { adisyonService } from "@/lib/services/adisyonService";
import { normalizePhone } from "@/lib/services/authService";
import { billingService } from "@/lib/services/billingService";
import { mealAttendanceService, type EmployeeAttendance } from "@/lib/services/mealAttendanceService";
import { notificationService } from "@/lib/services/notificationService";
import { ekstreService } from "@/lib/services/ekstreService";
import { pdfService } from "@/lib/services/pdfService";
import { userService } from "@/lib/services/userService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function CorporateInfoScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user, loading: authLoading } = useAuth();
    const { profile, loading: profileLoading } = useProfile(user?.id);

    const [activeTab, setActiveTab] = useState<'INFO' | 'EMPLOYEES' | 'DEBTS' | 'KONTROL'>('INFO');
    
    // INFO State
    const [companyName, setCompanyName] = useState("");
    const [taxNumber, setTaxNumber] = useState("");
    const [companyPhone, setCompanyPhone] = useState("");
    const [invoiceAddress, setInvoiceAddress] = useState("");
    const [saving, setSaving] = useState(false);

    // EMPLOYEES State
    const [employees, setEmployees] = useState<any[]>([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [newEmpName, setNewEmpName] = useState("");
    const [newEmpPhone, setNewEmpPhone] = useState("");

    // KONTROL State
    const [attendanceData, setAttendanceData] = useState<EmployeeAttendance[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState<string>(
        new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [attendanceSearch, setAttendanceSearch] = useState('');
    const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'DONE' | 'NOT_DONE'>('ALL');

    // DEBTS State
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [adminDebt, setAdminDebt] = useState<number>(0);
    const [selectedMonth, setSelectedMonth] = useState<{label:string;shortLabel:string;month:number;year:number}|null>(null);
    const [statusFilter, setStatusFilter] = useState<'ALL'|'OPEN'|'PAID'>('ALL');
    const [weekFilter, setWeekFilter] = useState(false);

    const [fetchedCompanyId, setFetchedCompanyId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase
                .from("companies")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (data) {
                setFetchedCompanyId(data.id);
            } else if (error) {
                console.error("fetchCompanyId error:", error);
            }
        };
        fetchCompanyId();
    }, [user?.id]);

    const actualCompanyId = fetchedCompanyId || profile?.corporate_info?.id || profile?.company_id;
    const isCompanyOwner = profile?.role === 'firma_sahibi' || profile?.role === 'owner' || profile?.role === 'corporate';

    useEffect(() => {
        if (!authLoading && !profileLoading && !isCompanyOwner) {
            router.replace("/(tabs)/home");
        }
    }, [authLoading, profileLoading, isCompanyOwner]);

    useEffect(() => {
        if (profile?.corporate_info) {
            setCompanyName(profile.corporate_info.companyName || "");
            setTaxNumber(profile.corporate_info.taxNumber || "");
            setCompanyPhone(profile.corporate_info.companyPhone || "");
            setInvoiceAddress(profile.corporate_info.invoiceAddress || "");
        }
    }, [profile]);

    useEffect(() => {
        if (!actualCompanyId) return;

        // Her seferinde benzersiz bir kanal ismi oluşturarak çakışmayı önleyelim
        const channelId = `company-updates-${actualCompanyId}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                { 
                    event: "*", 
                    schema: "public", 
                    table: "companies",
                    filter: `id=eq.${actualCompanyId}` 
                },
                () => {
                    loadOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [actualCompanyId]);

    useEffect(() => {
        if (activeTab === 'EMPLOYEES' && actualCompanyId) {
            loadEmployees();
        } else if (activeTab === 'DEBTS' && actualCompanyId) {
            loadOrders();
        } else if (activeTab === 'KONTROL' && actualCompanyId) {
            loadAttendance(attendanceDate, true);
        }
    }, [activeTab, actualCompanyId]);

    // ── KONTROL Fonksiyonları ──────────────────────────────────

    /** Seçili tarihe göre devam listesini yükle */
    const loadAttendance = async (date: string, triggerAuto = false) => {
        if (!actualCompanyId) return;
        setAttendanceLoading(true);
        try {
            const data = await mealAttendanceService.getDailyAttendance(actualCompanyId, date);
            setAttendanceData(data);

            // Otomatik bildirimler sadece bugün için ve doğru saatte çalışır
            if (triggerAuto && user?.id) {
                const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
                if (date === todayStr) await runAutoNotifications(data);
            }
        } catch (e) {
            console.error("loadAttendance hatası:", e);
        } finally {
            setAttendanceLoading(false);
        }
    };

    /** Tarih değiştir (gün ± kaydır) */
    const shiftDate = (days: number) => {
        const d = new Date(attendanceDate);
        d.setDate(d.getDate() + days);
        const newDate = d.toISOString().split('T')[0];
        setAttendanceDate(newDate);
        loadAttendance(newDate, false);
    };

    /** Bugüne dön */
    const goToday = () => {
        const t = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
        setAttendanceDate(t);
        loadAttendance(t, true);
    };

    /** Otomatik günlük bildirimler (13:00 çalışan / 16:00 firma sahibi) */
    const runAutoNotifications = async (data: EmployeeAttendance[]) => {
        if (!user?.id || !actualCompanyId) return;
        const hour = new Date().getHours();
        const todayKey = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 13:00–15:00 → yapmayanlara push
        const reminderKey = `meal_reminder_sent_${todayKey}`;
        const reminderSent = await AsyncStorage.getItem(reminderKey);
        if (!reminderSent && hour >= 13 && hour < 15) {
            const notDoneIds = data
                .filter(a => !a.hasMeal && a.userId !== user.id)
                .map(a => a.userId);
            if (notDoneIds.length > 0) {
                try {
                    await mealAttendanceService.sendReminderToUsers(notDoneIds);
                    await AsyncStorage.setItem(reminderKey, 'true');
                    console.log(`[Auto 13:00] Hatırlatma → ${notDoneIds.length} kişi`);
                } catch (e) { console.warn('Auto reminder error:', e); }
            }
        }

        // 16:00–20:00 → firma sahibine özet push
        const summaryKey = `meal_summary_sent_${todayKey}`;
        const summarySent = await AsyncStorage.getItem(summaryKey);
        if (!summarySent && hour >= 16 && hour < 20) {
            try {
                await mealAttendanceService.sendDailySummaryToOwner(actualCompanyId, user.id);
                await AsyncStorage.setItem(summaryKey, 'true');
                console.log('[Auto 16:00] Özet firma sahibine gönderildi');
            } catch (e) { console.warn('Auto summary error:', e); }
        }
    };

    /** Seçili kişilere (veya tüm yapmayanlara) manuel bildirim */
    const sendManualReminder = async (targetIds?: string[]) => {
        const notDone = attendanceData.filter(a => !a.hasMeal);
        const ids = targetIds ?? notDone.map(a => a.userId).filter(id => id !== user?.id);
        if (ids.length === 0) {
            Alert.alert('Bilgi', 'Bildirim gönderilecek kişi bulunamadı.');
            return;
        }
        setSendingReminder(true);
        try {
            await mealAttendanceService.sendReminderToUsers(ids);
            Alert.alert('✅ Gönderildi', `${ids.length} kişiye yemek hatırlatması gönderildi.`);
        } catch (e: any) {
            Alert.alert('Hata', 'Bildirim gönderilemedi: ' + (e.message || 'Bilinmeyen hata'));
        } finally {
            setSendingReminder(false);
        }
    };

    const loadEmployees = async () => {
        if (!actualCompanyId) {
            console.log("LoadEmployees: actualCompanyId bulunamadı.");
            return;
        }
        
        setEmpLoading(true);
        try {
            const data = await userService.getCompanyEmployees(actualCompanyId);
            setEmployees(data || []);
            
            if (!data || data.length === 0) {
                // Sessizce ama geliştirme için log'layarak
                console.log("Çalışan listesi boş döndü. Firma ID:", actualCompanyId);
            }
        } catch (e: any) {
            console.error("LoadEmployees Hatası:", e);
        } finally {
            setEmpLoading(false);
        }
    };

    const loadOrders = async () => {
        if (!actualCompanyId) return;
        setOrdersLoading(true);
        try {
            const data = await adisyonService.getCompanyOrders(actualCompanyId);
            setOrders(data || []);
            
            if (user?.id) {
                const balanceData = await billingService.getCompanyBalance(user.id);
                if (balanceData) setAdminDebt(balanceData.balance || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setOrdersLoading(false);
        }
    };

    const handleDownloadEkstre = async () => {
        if (!actualCompanyId) return;
        setSaving(true);
        try {
            let firstDay: string;
            let lastDay: string;

            if (weekFilter) {
                const now = new Date();
                const day = now.getDay();
                const diff = day === 0 ? -6 : 1 - day;
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() + diff);
                // toISOString() UTC'ye çevirir, timezone'a göre gün kayar — local string kullan
                const pad = (n: number) => String(n).padStart(2, '0');
                firstDay = `${startOfWeek.getFullYear()}-${pad(startOfWeek.getMonth()+1)}-${pad(startOfWeek.getDate())}`;
                lastDay = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
            } else if (selectedMonth) {
                // toISOString() UTC'ye çevirir, Türkiye UTC+3 olduğu için gün kayar — direkt string yaz
                const pad = (n: number) => String(n).padStart(2, '0');
                const lastDateOfMonth = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
                firstDay = `${selectedMonth.year}-${pad(selectedMonth.month)}-01`;
                lastDay = `${selectedMonth.year}-${pad(selectedMonth.month)}-${pad(lastDateOfMonth)}`;
            } else {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                const m = now.getMonth() + 1;
                const lastDateOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                firstDay = `${now.getFullYear()}-${pad(m)}-01`;
                lastDay = `${now.getFullYear()}-${pad(m)}-${pad(lastDateOfMonth)}`;
            }
            
            const data = await ekstreService.getEkstreVerisi(actualCompanyId, firstDay, lastDay);
            const { uri } = await Print.printToFileAsync({ html: pdfService.generateHesapEkstresi(data) });
            await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(error);
            Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveInfo = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            await userService.updateCorporateInfo(user.id, {
                companyName,
                taxNumber,
                companyPhone,
                invoiceAddress
            });
            Alert.alert("Başarılı", "Kurumsal fatura bilgileriniz güncellendi.");
        } catch (error: any) {
            Alert.alert("Hata", error.message || "Bilgiler kaydedilirken bir hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddEmployee = async (isGuest: boolean = false) => {
        if (!actualCompanyId) return Alert.alert("Hata", "Firma bilgisi bulunamadı.");
        
        let formattedPhone = newEmpPhone.trim();
        if (!isGuest) {
            const normalized = normalizePhone(formattedPhone);
            if (!normalized) {
                return Alert.alert("Hata", "Lütfen geçerli bir telefon numarası girin (5XX...).");
            }
            formattedPhone = normalized;
        }

        if (!newEmpName.trim()) {
            return Alert.alert("Hata", "Lütfen ad soyad giriniz.");
        }

        try {
            setEmpLoading(true);
            await userService.addEmployee(
                actualCompanyId, 
                newEmpName, 
                isGuest ? "Misafir" : formattedPhone, 
                isGuest ? "guest" : "customer", 
                true
            );
            
            setNewEmpName("");
            setNewEmpPhone("");
            
            // Listeyi anında yenile
            await loadEmployees();
            
            Alert.alert("Başarılı", isGuest ? "Misafir eklendi." : "Çalışan eklendi/güncellendi.");
        } catch (e: any) {
            console.error("Add employee error:", e);
            Alert.alert("Hata", "Eklenemedi: " + (e.message || "Bilinmeyen hata"));
        } finally {
            setEmpLoading(false);
        }
    };

    const handleDeleteEmployee = (id: string) => {
        Alert.alert("Emin Misiniz?", "Bu kişiyi listeden çıkarmak istediğinize emin misiniz?", [
            { text: "İptal", style: "cancel" },
            { text: "Sil", style: "destructive", onPress: async () => {
                try {
                    setEmpLoading(true);
                    await userService.deleteEmployee(id);
                    await loadEmployees();
                } catch (e: any) {
                    Alert.alert("Hata", "Silinemedi: " + e.message);
                } finally {
                    setEmpLoading(false);
                }
            }}
        ]);
    };

    const handleFileUpload = async () => {
        if (!actualCompanyId) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            setEmpLoading(true);
            const fileUri = result.assets[0].uri;
            const fileString = await new File(fileUri).text();
            
            Papa.parse(fileString, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        const parsedEmployees = results.data.map((row: any) => {
                            let rawPhone = (row.Telefon || row.Phone || row.Tel || "").toString();
                            let normalized = normalizePhone(rawPhone);
                            
                            return {
                                fullName: row.Ad || row.Name || row.AdSoyad || "İsimsiz",
                                phone: normalized || rawPhone // Normalize edemezse olduğu gibi kalsın ama genellikle eder
                            };
                        }).filter(e => e.fullName !== "İsimsiz");

                        if (parsedEmployees.length === 0) {
                            Alert.alert("Hata", "CSV formatı uygun değil. Sütun adları 'Ad' veya 'AdSoyad' ve 'Telefon' olmalıdır.");
                            return;
                        }

                        await userService.uploadEmployeesCSV(actualCompanyId, parsedEmployees);
                        await loadEmployees();
                        Alert.alert("Başarılı", `${parsedEmployees.length} çalışan başarıyla yüklendi.`);
                    } catch (e: any) {
                        Alert.alert("Hata", "Çalışanlar yüklenemedi: " + e.message);
                    }
                },
                error: (error: any) => {
                    Alert.alert("Hata", "Dosya okunamadı: " + error.message);
                }
            });
        } catch (error: any) {
            Alert.alert("Dosya Hatası", error.message);
        } finally {
            setEmpLoading(false);
        }
    };

    const monthList = useMemo(() => {
        const names = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
        const now = new Date();
        return Array.from({length:12}, (_,i) => {
            const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
            return {
                label: `${names[d.getMonth()]} ${d.getFullYear()}`,
                shortLabel: `${names[d.getMonth()].substring(0,3)} ${d.getFullYear()}`,
                month: d.getMonth()+1,
                year: d.getFullYear(),
            };
        });
    }, []);

    useEffect(() => {
        if (!selectedMonth && monthList.length > 0) setSelectedMonth(monthList[0]);
    }, [monthList]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (["CANCELLED","İptal"].includes(o.status)) return false;
            const d = new Date(o.created_at || o.date);
            if (weekFilter) {
                const now = new Date();
                const startOfWeek = new Date(now);
                const day = now.getDay();
                const diff = day === 0 ? -6 : 1 - day;
                startOfWeek.setDate(now.getDate() + diff);
                startOfWeek.setHours(0,0,0,0);
                return d >= startOfWeek;
            }
            if (selectedMonth) {
                return d.getMonth()+1 === selectedMonth.month && d.getFullYear() === selectedMonth.year;
            }
            return true;
        });
    }, [orders, selectedMonth, weekFilter]);

    const { mealOrdersFiltered, financialEntriesFiltered, mealDays, lastClosingDate } = useMemo(() => {
        const meals = filteredOrders.filter((o: any) => o.order_type === 'Şimdi Ye' || o.order_type === 'Sipariş Ver');
        const financial = orders
            .filter((o: any) => o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT')
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const closings = financial.filter((e: any) => (e.note || '').includes('Ay Kapanışı'));
        const lastClosing: Date | null = closings.length > 0 ? new Date(closings[0].created_at) : null;

        const paymentEntries = financial.filter((e: any) => e.order_type === 'MANUAL_PAYMENT');
        const lastPayment: Date | null = paymentEntries.length > 0 ? new Date(paymentEntries[0].created_at) : null;

        const mealsWithStatus = meals.map((o: any) => {
            const mealDate = new Date(o.created_at);
            const isPaid =
                (lastClosing !== null && mealDate < lastClosing) ||
                (lastPayment !== null && mealDate < lastPayment) ||
                ['PAID','ÖDENDİ'].includes((o.status||'').toUpperCase()); // COMPLETED/TAMAMLANDI teslimat durumu, ödeme değil
            return { ...o, isPaid };
        });

        const finalMeals = statusFilter === 'OPEN' ? mealsWithStatus.filter((o: any) => !o.isPaid)
            : statusFilter === 'PAID' ? mealsWithStatus.filter((o: any) => o.isPaid)
            : mealsWithStatus;

        const byDay: Record<string, {dateKey:string;date:Date;mealOrders:any[]}> = {};
        finalMeals.forEach((o: any) => {
            const d = new Date(o.created_at);
            const key = d.toISOString().split('T')[0];
            if (!byDay[key]) byDay[key] = { dateKey: key, date: d, mealOrders: [] };
            byDay[key].mealOrders.push(o);
        });
        const days = Object.values(byDay).sort((a,b) => b.date.getTime()-a.date.getTime());

        // Seçili döneme ait finansal kayıtlar
        let financialForPeriod: typeof financial;
        if (statusFilter === 'OPEN') {
            financialForPeriod = [];
        } else if (weekFilter) {
            // Bu haftanın başını hesapla (Pazartesi)
            const nowW = new Date();
            const dayW = nowW.getDay();
            const diffW = dayW === 0 ? -6 : 1 - dayW;
            const startOfWeek = new Date(nowW);
            startOfWeek.setDate(nowW.getDate() + diffW);
            startOfWeek.setHours(0, 0, 0, 0);
            const weekEntries = financial.filter((e: any) => new Date(e.created_at) >= startOfWeek);
            // Bu haftanın net borcu
            const weekDebt = weekEntries.filter((e: any) => e.order_type === 'MANUAL_DEBT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
            const weekPaid = weekEntries.filter((e: any) => e.order_type === 'MANUAL_PAYMENT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
            const weekPrevBalance = Math.round(adminDebt - (weekDebt - weekPaid));
            if (weekPrevBalance > 0) {
                const carryEntry = {
                    id: '__carryover__',
                    order_type: 'MANUAL_DEBT',
                    created_at: startOfWeek.toISOString(),
                    total_amount: weekPrevBalance,
                    note: 'Önceki dönemlerden devir borcu',
                };
                financialForPeriod = [...weekEntries, carryEntry]
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else {
                financialForPeriod = weekEntries;
            }
        } else if (selectedMonth) {
            // Seçili aya ait kayıtlar
            const monthEntries = financial.filter((e: any) => {
                const d = new Date(e.created_at);
                return d.getMonth() + 1 === selectedMonth.month && d.getFullYear() === selectedMonth.year;
            });
            // Bu ayın net borcu (MANUAL_DEBT - MANUAL_PAYMENT)
            const currentMonthDebt = monthEntries
                .filter((e: any) => e.order_type === 'MANUAL_DEBT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
            const currentMonthPaid = monthEntries
                .filter((e: any) => e.order_type === 'MANUAL_PAYMENT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
            // Önceki dönemlerden devir = Gerçek güncel bakiye - Bu ayın net borcu
            // adminDebt DB'den gelen kesin bakiye, ham entry toplamından çok daha güvenilir
            const prevBalance = Math.round(adminDebt - (currentMonthDebt - currentMonthPaid));
            if (prevBalance > 0) {
                // Önceki dönemden ödenmemiş bakiye var — sentetik devir satırı ekle
                const carryEntry = {
                    id: '__carryover__',
                    order_type: 'MANUAL_DEBT',
                    created_at: new Date(selectedMonth.year, selectedMonth.month - 1, 1).toISOString(),
                    total_amount: prevBalance,
                    note: 'Önceki dönemlerden devir borcu',
                };
                financialForPeriod = [...monthEntries, carryEntry]
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else {
                financialForPeriod = monthEntries;
            }
        } else {
            financialForPeriod = financial;
        }
        const filteredFinancial = financialForPeriod;

        return { mealOrdersFiltered: finalMeals, financialEntriesFiltered: filteredFinancial, mealDays: days, lastClosingDate: lastClosing };
    }, [filteredOrders, orders, statusFilter, weekFilter, selectedMonth, adminDebt]);

    const totalDebt = adminDebt;

    const handleCloseMonth = async () => {
        if (!actualCompanyId || !user?.id) return;

        const now = new Date();
        const monthName = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

        Alert.alert(
            "Ay Kapanışını Onayla",
            `${monthName} dönemi için ay kapanışını onaylıyor musunuz?\n\nBu işlem:\n• Tüm ödenmemiş siparişleri "Ödendi" olarak işaretler\n• Toplam borcu sıfırlar\n• Geri alınamaz`,
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Onayla",
                    style: "destructive",
                    onPress: async () => {
                        setSaving(true);
                        try {
                            // employees state boşsa (EMPLOYEES sekmesi hiç açılmadıysa) fresh çek
                            const empList = employees.length > 0
                                ? employees
                                : await userService.getCompanyEmployees(actualCompanyId!);
                            const empIds = empList.map((e: any) => e.id).filter(Boolean);
                            await billingService.closeMonth(actualCompanyId!, user.id, empIds);
                            await loadOrders();
                            Alert.alert("✅ Başarılı", `${monthName} ay kapanışı tamamlandı. Tüm borçlar sıfırlandı.`);
                        } catch (error: any) {
                            console.error("Ay kapanışı hatası:", error);
                            Alert.alert("Hata", "Ay kapanışı tamamlanamadı: " + (error.message || "Bilinmeyen hata"));
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    if (profileLoading || authLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isCompanyOwner) {
        return null;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => { Keyboard.dismiss(); router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"); }}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Firma Sahibi</Text>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'INFO' && styles.tabBtnActive]} onPress={() => setActiveTab('INFO')}>
                    <MaterialIcons name="info" size={18} color={activeTab === 'INFO' ? colors.primary : colors.muted} />
                    <Text style={[styles.tabText, activeTab === 'INFO' && styles.tabTextActive, { marginTop: 4 }]}>Bilgiler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'EMPLOYEES' && styles.tabBtnActive]} onPress={() => setActiveTab('EMPLOYEES')}>
                    <MaterialIcons name="group" size={18} color={activeTab === 'EMPLOYEES' ? colors.primary : colors.muted} />
                    <Text style={[styles.tabText, activeTab === 'EMPLOYEES' && styles.tabTextActive, { marginTop: 4 }]}>Çalışanlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'DEBTS' && styles.tabBtnActive]} onPress={() => setActiveTab('DEBTS')}>
                    <MaterialIcons name="receipt" size={18} color={activeTab === 'DEBTS' ? colors.primary : colors.muted} />
                    <Text style={[styles.tabText, activeTab === 'DEBTS' && styles.tabTextActive, { marginTop: 4 }]}>Borçlar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'KONTROL' && styles.tabBtnActive]} onPress={() => setActiveTab('KONTROL')}>
                    <MaterialIcons name="checklist" size={18} color={activeTab === 'KONTROL' ? colors.primary : colors.muted} />
                    <Text style={[styles.tabText, activeTab === 'KONTROL' && styles.tabTextActive, { marginTop: 4 }]}>Kontrol</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* INFO TAB */}
                {activeTab === 'INFO' && (
                    <View style={{ gap: 20 }}>
                        <View style={styles.infoBanner}>
                            <MaterialIcons name="receipt-long" size={24} color={colors.primary} />
                            <Text style={styles.infoText}>Fatura kesilebilmesi için kurumsal bilgilerinizi eksiksiz doldurunuz.</Text>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Firma / Şirket Adı</Text>
                            <View style={styles.inputContainer}>
                                <MaterialIcons name="business" size={20} color={colors.muted} />
                                <TextInput 
                                    style={styles.input} 
                                    value={companyName} 
                                    onChangeText={setCompanyName}
                                    placeholder="Firma Adını Giriniz"
                                />
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Vergi Numarası / TCKN</Text>
                            <View style={styles.inputContainer}>
                                <MaterialIcons name="tag" size={20} color={colors.muted} />
                                <TextInput 
                                    style={styles.input} 
                                    value={taxNumber} 
                                    onChangeText={setTaxNumber}
                                    placeholder="Vergi No"
                                />
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Firma Telefon Numarası</Text>
                            <View style={styles.inputContainer}>
                                <MaterialIcons name="phone" size={20} color={colors.muted} />
                                <TextInput style={styles.input} value={companyPhone} onChangeText={setCompanyPhone} keyboardType="phone-pad" />
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Fatura Adresi</Text>
                            <View style={[styles.inputContainer, styles.textAreaContainer]}>
                                <MaterialIcons name="location-on" size={20} color={colors.muted} style={{ marginTop: 14 }} />
                                <TextInput style={[styles.input, styles.textArea]} value={invoiceAddress} onChangeText={setInvoiceAddress} multiline textAlignVertical="top" numberOfLines={4} />
                            </View>
                        </View>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveInfo} disabled={saving} activeOpacity={0.8}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Bilgileri Kaydet</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {/* EMPLOYEES TAB */}
                {activeTab === 'EMPLOYEES' && (
                    <View style={{ gap: 24 }}>
                        {/* Ekleme Formu */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Yeni Kişi Ekle</Text>
                            <TextInput 
                                style={styles.basicInput} 
                                placeholder="Ad Soyad" 
                                placeholderTextColor={colors.muted} 
                                value={newEmpName} 
                                onChangeText={setNewEmpName} 
                            />
                            <View style={styles.phoneInputWrapper}>
                                <View style={styles.prefixBox}>
                                    <Text style={styles.prefixText}>+90</Text>
                                </View>
                                <TextInput 
                                    style={styles.phoneInput} 
                                    placeholder="5XX XXX XX XX" 
                                    placeholderTextColor={colors.muted} 
                                    value={newEmpPhone} 
                                    onChangeText={(val) => setNewEmpPhone(val.replace(/[^0-9]/g, ''))} 
                                    keyboardType="phone-pad" 
                                    maxLength={10}
                                />
                            </View>
                            <View style={{ marginTop: 8 }}>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleAddEmployee(false)}>
                                    <Text style={styles.actionBtnText}>Çalışan Ekle</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Toplu Yükleme */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Toplu Ekleme</Text>
                            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>Çok sayıda çalışanınız varsa, "Ad" ve "Telefon" sütunları içeren bir CSV dosyası yükleyebilirsiniz.</Text>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }]} onPress={handleFileUpload}>
                                <MaterialIcons name="upload-file" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Liste Yükle (.csv)</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Table */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Aktif Çalışanlar & Misafirler</Text>
                            {empLoading ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                            ) : employees.length === 0 ? (
                                <Text style={{ color: colors.muted, fontStyle: 'italic', marginVertical: 12 }}>Kayıtlı kişi bulunamadı.</Text>
                            ) : (
                                <View style={styles.table}>
                                    <View style={styles.tableHead}>
                                        <Text style={[styles.th, { flex: 2 }]}>İsim</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Telefon</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Tarih</Text>
                                        <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>İşlem</Text>
                                    </View>
                                    {employees.map(emp => (
                                        <View key={emp.id} style={styles.tableRow}>
                                            <Text style={[styles.td, { flex: 2, fontWeight: 'bold' }]} numberOfLines={1}>{emp.full_name}</Text>
                                            <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>{emp.phone}</Text>
                                            <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                                                {emp.created_at ? new Date(emp.created_at).toLocaleDateString('tr-TR') : '-'}
                                            </Text>
                                            <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => handleDeleteEmployee(emp.id)}>
                                                <View style={{ backgroundColor: colors.dangerBg, padding: 6, borderRadius: 8 }}>
                                                    <MaterialIcons name="delete" size={16} color={colors.danger} />
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* DEBTS TAB */}
                {activeTab === 'DEBTS' && (
                    <View style={{ gap: 16 }}>
                        {/* Özet Kartlar */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.sectionCard, { flex: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: adminDebt > 0 ? colors.dangerBg : colors.surface, borderColor: adminDebt > 0 ? colors.danger : colors.surfaceBorder }]}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: adminDebt > 0 ? colors.danger : colors.muted, marginBottom: 4 }}>GÜNCEL BORÇ</Text>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: adminDebt > 0 ? colors.danger : '#16a34a' }}>
                                    {adminDebt > 0 ? `₺${adminDebt.toLocaleString('tr-TR')}` : 'Temiz'}
                                </Text>
                            </View>
                            <View style={[styles.sectionCard, { flex: 1, alignItems: 'center', paddingVertical: 16 }]}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.muted, marginBottom: 4 }}>BU DÖNEM TABAK</Text>
                                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{mealOrdersFiltered.reduce((acc: number, o: any) => acc + (o.adisyon_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0)}</Text>
                            </View>
                        </View>

                        {/* Ay Seçici */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                            <TouchableOpacity
                                style={[styles.monthPill, weekFilter && styles.monthPillActive]}
                                onPress={() => setWeekFilter(true)}
                            >
                                <Text style={[styles.monthPillText, weekFilter && styles.monthPillTextActive]}>Bu Hafta</Text>
                            </TouchableOpacity>
                            {monthList.map((m) => (
                                <TouchableOpacity
                                    key={m.label}
                                    style={[styles.monthPill, !weekFilter && selectedMonth?.label === m.label && styles.monthPillActive]}
                                    onPress={() => { setWeekFilter(false); setSelectedMonth(m); }}
                                >
                                    <Text style={[styles.monthPillText, !weekFilter && selectedMonth?.label === m.label && styles.monthPillTextActive]}>
                                        {m.shortLabel}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Durum Filtresi */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {(['ALL','OPEN','PAID'] as const).map(f => (
                                <TouchableOpacity
                                    key={f}
                                    onPress={() => setStatusFilter(f)}
                                    style={[styles.statusPill, statusFilter === f && styles.statusPillActive]}
                                >
                                    <Text style={[styles.statusPillText, statusFilter === f && styles.statusPillTextActive]}>
                                        {f === 'ALL' ? 'Tümü' : f === 'OPEN' ? 'Açık' : 'Ödendi'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* PDF Butonu */}
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleDownloadEkstre} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <MaterialIcons name="picture-as-pdf" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.actionBtnText}>PDF Ekstre İndir</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {ordersLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
                        ) : (
                            <>
                                {/* YEMEKLERİ BÖLÜMÜ */}
                                {mealDays.length > 0 && (
                                    <>
                                        <Text style={styles.dokumsectionLabel}>YEMEKLERİ</Text>
                                        {mealDays.map(({ dateKey, date, mealOrders }) => (
                                            <View key={dateKey} style={styles.dayBlock}>
                                                <View style={styles.dayHeader}>
                                                    <Text style={styles.dayDate}>
                                                        {date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </Text>
                                                    <View style={[styles.dokumBadge, mealOrders[0]?.isPaid ? styles.dokumBadgePaid : styles.dokumBadgeOpen]}>
                                                        <Text style={[styles.dokumBadgeText, { color: mealOrders[0]?.isPaid ? '#3B6D11' : '#854F0B' }]}>
                                                            {mealOrders[0]?.isPaid ? 'Ödendi' : 'Açık'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                {mealOrders.map((order: any) => {
                                                    const items = order.adisyon_items || [];
                                                    // Tüm tabldot itemleri (birden fazla olabilir)
                                                    const tabldotItems = items.filter((i: any) => Array.isArray(i.selections) && i.selections.length > 0);
                                                    const otherItems = items.filter((i: any) => !Array.isArray(i.selections) || i.selections.length === 0);
                                                    const initials = (order.userName || 'M').split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase();
                                                    return (
                                                        <View key={order.id} style={[styles.personRow, order.isPaid && { opacity: 0.5 }]}>
                                                            <View style={styles.dokumAvatar}>
                                                                <Text style={styles.dokumAvatarText}>{initials}</Text>
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.personName}>{order.userName || 'Müşteri'}</Text>
                                                                {tabldotItems.length > 0 ? (
                                                                    // Her tabldot itemini ayrı ayrı göster
                                                                    tabldotItems.map((tabItem: any, idx: number) => (
                                                                        <View key={idx} style={idx > 0 ? { marginTop: 6 } : {}}>
                                                                            <View style={styles.tabldotTag}>
                                                                                <Text style={styles.tabldotTagText}>{tabItem.selections.length}'lü Tabldot</Text>
                                                                            </View>
                                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                                                {tabItem.selections.map((s: any, i: number) => (
                                                                                    <View key={i} style={styles.mealChip}>
                                                                                        <Text style={styles.mealChipText}>{s.item_name}</Text>
                                                                                    </View>
                                                                                ))}
                                                                            </View>
                                                                        </View>
                                                                    ))
                                                                ) : otherItems.length > 0 ? (
                                                                    otherItems.map((item: any, i: number) => (
                                                                        <Text key={i} style={styles.otherItemText}>
                                                                            {item.quantity}x {item.menu_items?.name || 'Yemek'}
                                                                        </Text>
                                                                    ))
                                                                ) : (
                                                                    <Text style={styles.otherItemText}>Yemek siparişi</Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </>
                                )}

                                {/* HESAP HAREKETLERİ BÖLÜMÜ */}
                                {financialEntriesFiltered.length > 0 && (
                                    <>
                                        <Text style={styles.dokumsectionLabel}>HESAP HAREKETLERİ</Text>
                                        <View style={styles.financeCard}>
                                            {financialEntriesFiltered.map((entry: any, idx: number) => {
                                                const isPayment = entry.order_type === 'MANUAL_PAYMENT';
                                                const isClosing = (entry.note || '').includes('Ay Kapanışı');
                                                const isDebtCovered = !isPayment && !isClosing && (entry.total_amount || 0) <= 0;
                                                const entryDate = new Date(entry.created_at);
                                                const label = isPayment ? 'Kısmi Ödeme' : isClosing ? 'Ay Kapanışı' : 'Borç Girişi';
                                                const badgeStyle = isPayment ? styles.dokumBadgePayment : isClosing ? styles.dokumBadgeClosing : isDebtCovered ? styles.dokumBadgePayment : styles.dokumBadgeOpen;
                                                const badgeLabel = isPayment ? 'İşlendi' : isClosing ? 'Kapandı' : isDebtCovered ? 'Ödendi' : 'Açık';
                                                const badgeColor = isPayment ? '#3B6D11' : isClosing ? '#185FA5' : isDebtCovered ? '#3B6D11' : '#854F0B';
                                                const notLast = idx !== financialEntriesFiltered.length - 1;
                                                return (
                                                    <View key={entry.id} style={[styles.financeRow, notLast && { borderBottomWidth: 0.5, borderColor: colors.surfaceBorder }]}>
                                                        <Text style={styles.financeDate}>{entryDate.toLocaleDateString('tr-TR')}</Text>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.financeLabel}>{label}</Text>
                                                            {entry.note ? <Text style={styles.financeNote} numberOfLines={1}>{entry.note}</Text> : null}
                                                        </View>
                                                        {entry.total_amount > 0 && (
                                                            <Text style={[styles.financeAmount, { color: isPayment ? '#16a34a' : colors.text }]}>
                                                                {isPayment ? '-' : '+'}₺{entry.total_amount.toLocaleString('tr-TR')}
                                                            </Text>
                                                        )}
                                                        <View style={[styles.dokumBadge, badgeStyle, { marginLeft: 8 }]}>
                                                            <Text style={[styles.dokumBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}

                                {mealDays.length === 0 && financialEntriesFiltered.length === 0 && (
                                    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                                        <MaterialIcons name="receipt-long" size={48} color={colors.surfaceBorder} />
                                        <Text style={{ color: colors.muted, fontWeight: '600', textAlign: 'center' }}>
                                            {statusFilter === 'PAID'
                                                ? 'Bu dönem için henüz ödeme yapılmadı.'
                                                : statusFilter === 'OPEN'
                                                ? 'Bu dönem için açık kayıt bulunmuyor.'
                                                : 'Bu dönem için kayıt bulunamadı.'}
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                )}

                {/* KONTROL TAB — Günlük Yemek Bildirimi Takibi */}
                {activeTab === 'KONTROL' && (() => {
                    const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
                    const isToday = attendanceDate === todayStr;
                    const done    = attendanceData.filter(a => a.hasMeal);
                    const notDone = attendanceData.filter(a => !a.hasMeal);

                    // Arama + filtre uygula
                    const filtered = attendanceData.filter(a => {
                        const matchSearch = a.fullName.toLowerCase().includes(attendanceSearch.toLowerCase());
                        const matchFilter =
                            attendanceFilter === 'ALL' ? true :
                            attendanceFilter === 'DONE' ? a.hasMeal : !a.hasMeal;
                        return matchSearch && matchFilter;
                    });

                    // Tarih formatlayıcı
                    const fmtDate = (d: string) => {
                        const dt = new Date(d + 'T12:00:00');
                        return dt.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    };

                    return (
                        <View style={{ gap: 16 }}>

                            {/* ── Tarih Navigasyon ── */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity
                                    onPress={() => shiftDate(-1)}
                                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 10 }}
                                >
                                    <MaterialIcons name="chevron-left" size={22} color={colors.text} />
                                </TouchableOpacity>
                                <View style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: isToday ? colors.primary : colors.surfaceBorder, borderRadius: 12, padding: 12, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: isToday ? colors.primary : colors.text }}>
                                        {isToday ? '📅 BUGÜN' : '📅 GEÇMİŞ'}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{fmtDate(attendanceDate)}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => shiftDate(1)}
                                    disabled={isToday}
                                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 10, opacity: isToday ? 0.3 : 1 }}
                                >
                                    <MaterialIcons name="chevron-right" size={22} color={colors.text} />
                                </TouchableOpacity>
                                {!isToday && (
                                    <TouchableOpacity
                                        onPress={goToday}
                                        style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Bugün</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={() => loadAttendance(attendanceDate, isToday)}
                                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 10 }}
                                >
                                    <MaterialIcons name="refresh" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* ── Özet Sayaçlar ── */}
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1, backgroundColor: '#10b98115', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#10b98130', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#10b981' }}>{done.length}</Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10b981', marginTop: 2 }}>✅ Yemek Yedi</Text>
                                </View>
                                <View style={{ flex: 1, backgroundColor: colors.dangerBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.dangerBorder, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 26, fontWeight: '900', color: colors.danger }}>{notDone.length}</Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.danger, marginTop: 2 }}>❌ Yemedi</Text>
                                </View>
                                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text }}>{attendanceData.length}</Text>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.muted, marginTop: 2 }}>👥 Toplam</Text>
                                </View>
                            </View>

                            {/* ── Toplu Bildirim (sadece bugün, yapmayanlar varsa) ── */}
                            {isToday && notDone.filter(a => a.userId !== user?.id).length > 0 && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                                    onPress={() => sendManualReminder()}
                                    disabled={sendingReminder}
                                    activeOpacity={0.8}
                                >
                                    {sendingReminder ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="notifications-active" size={18} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.actionBtnText}>
                                                Yapmayanlara Bildirim Gönder ({notDone.filter(a => a.userId !== user?.id).length} kişi)
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            {/* ── Otomatik bildirim bilgisi ── */}
                            {isToday && (
                                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', gap: 8 }}>
                                    <MaterialIcons name="info-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                                    <Text style={{ flex: 1, fontSize: 11, color: colors.muted, lineHeight: 17 }}>
                                        {'Otomatik: 13:00 → yapmayanlara hatırlatma  •  16:00 → size özet. Her bildirim günde 1 kez gönderilir.'}
                                    </Text>
                                </View>
                            )}

                            {/* ── Arama & Filtre ── */}
                            <View style={{ gap: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: 14, height: 44 }}>
                                    <MaterialIcons name="search" size={18} color={colors.muted} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: colors.text }}
                                        placeholder="Çalışan ara..."
                                        placeholderTextColor={colors.muted}
                                        value={attendanceSearch}
                                        onChangeText={setAttendanceSearch}
                                    />
                                    {attendanceSearch.length > 0 && (
                                        <TouchableOpacity onPress={() => setAttendanceSearch('')}>
                                            <MaterialIcons name="close" size={18} color={colors.muted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {(['ALL', 'DONE', 'NOT_DONE'] as const).map(f => (
                                        <TouchableOpacity
                                            key={f}
                                            onPress={() => setAttendanceFilter(f)}
                                            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: attendanceFilter === f ? colors.primary : colors.surface, borderWidth: 1, borderColor: attendanceFilter === f ? colors.primary : colors.surfaceBorder }}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: attendanceFilter === f ? '#fff' : colors.muted }}>
                                                {f === 'ALL' ? 'Tümü' : f === 'DONE' ? '✅ Yemek Yedi' : '❌ Yemedi'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* ── Liste ── */}
                            {attendanceLoading ? (
                                <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
                            ) : filtered.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                                    <MaterialIcons name="people-outline" size={48} color={colors.surfaceBorder} />
                                    <Text style={{ color: colors.muted, fontWeight: '600' }}>
                                        {attendanceData.length === 0 ? 'Çalışan bulunamadı veya SQL migration çalıştırılmadı.' : 'Arama sonucu yok.'}
                                    </Text>
                                    <TouchableOpacity onPress={() => loadAttendance(attendanceDate, isToday)} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Yenile</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.sectionCard}>
                                    {filtered.map((emp, idx) => (
                                        <View
                                            key={emp.userId}
                                            style={{ paddingVertical: 14, borderBottomWidth: idx < filtered.length - 1 ? 1 : 0, borderColor: colors.surfaceBorder }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                {/* Durum ikonu */}
                                                <View style={{
                                                    width: 40, height: 40, borderRadius: 20,
                                                    backgroundColor: emp.hasMeal ? '#10b98120' : colors.dangerBg,
                                                    alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <MaterialIcons
                                                        name={emp.hasMeal ? 'check-circle' : 'cancel'}
                                                        size={22}
                                                        color={emp.hasMeal ? '#10b981' : colors.danger}
                                                    />
                                                </View>

                                                {/* İsim + Telefon */}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>{emp.fullName}</Text>
                                                    <Text style={{ fontSize: 11, color: colors.muted }}>{emp.phone || '—'}</Text>
                                                </View>

                                                {/* Durum badge */}
                                                <View style={{
                                                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                                                    backgroundColor: emp.hasMeal ? '#10b98120' : colors.dangerBg
                                                }}>
                                                    <Text style={{ fontSize: 11, fontWeight: '900', color: emp.hasMeal ? '#10b981' : colors.danger }}>
                                                        {emp.hasMeal ? 'Yemek Yedi' : 'Yemedi'}
                                                    </Text>
                                                </View>

                                                {/* Tekil bildirim butonu (sadece bugün + yapmadıysa + firma sahibi değilse) */}
                                                {isToday && !emp.hasMeal && emp.userId !== user?.id && (
                                                    <TouchableOpacity
                                                        onPress={() => sendManualReminder([emp.userId])}
                                                        disabled={sendingReminder}
                                                        style={{ backgroundColor: '#f59e0b20', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#f59e0b40' }}
                                                    >
                                                        <MaterialIcons name="notifications" size={16} color="#f59e0b" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* Ne yedi detayı */}
                                            {emp.hasMeal && emp.items.length > 0 && (
                                                <View style={{ marginTop: 8, marginLeft: 52, backgroundColor: colors.background, borderRadius: 10, padding: 10, gap: 3 }}>
                                                    {emp.items.map((item, i) => (
                                                        <Text key={i} style={{ fontSize: 12, color: colors.muted }}>
                                                            <Text style={{ fontWeight: 'bold', color: colors.text }}>{item.quantity}x </Text>
                                                            {item.name}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}

                                            {/* Yaptı ama items boşsa (tabldot/paket siparişi olabilir) */}
                                            {emp.hasMeal && emp.items.length === 0 && (
                                                <View style={{ marginTop: 6, marginLeft: 52 }}>
                                                    <Text style={{ fontSize: 11, color: colors.muted, fontStyle: 'italic' }}>Yemek detayı yükleniyor...</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })()}

            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },

    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderColor: 'transparent',
    },
    tabBtnActive: {
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.muted,
    },
    tabTextActive: {
        color: colors.primary,
    },

    scrollContent: { padding: 24, paddingBottom: 40 },

    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 16 },

    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.infoBg,
        padding: 16, borderRadius: 16,
        borderWidth: 1, borderColor: colors.infoBorder,
    },
    infoText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18, fontWeight: '500' },

    formGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginLeft: 4 },

    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, minHeight: 56
    },
    textAreaContainer: { alignItems: 'flex-start', paddingVertical: 4 },
    input: { flex: 1, fontSize: 15, color: colors.text, height: '100%' },
    readOnlyInput: {
        backgroundColor: colors.background,
        borderColor: colors.surfaceBorder + '80',
    },
    textArea: { minHeight: 90, paddingTop: 12, paddingBottom: 12 },

    saveBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: 'bold' },

    basicInput: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: colors.text,
        marginBottom: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },

    table: {
        backgroundColor: colors.background,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    tableHead: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceBorder,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    th: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.text,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
    },
    td: {
        fontSize: 13,
        color: colors.text,
    },
    periodTab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    periodTabActive: {
        backgroundColor: colors.primary,
        borderColor: '#ed1c24',
    },
    periodTabText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.muted,
    },
    periodTabTextActive: {
        color: '#fff',
    },
    // Ay seçici pills
    monthPill: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    monthPillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    monthPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.muted,
    },
    monthPillTextActive: {
        color: '#fff',
    },
    // Durum filtresi
    statusPill: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    statusPillActive: {
        backgroundColor: colors.primary + '18',
        borderColor: colors.primary,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.muted,
    },
    statusPillTextActive: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    // Section Label
    dokumsectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.muted,
        letterSpacing: 1.5,
        marginTop: 4,
        marginBottom: 4,
    },
    // Gün bloğu
    dayBlock: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginBottom: 8,
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    dayDate: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    // Kişi satırı
    personRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 0.5,
        borderColor: colors.surfaceBorder,
    },
    dokumAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.primary + '22',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dokumAvatarText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.primary,
    },
    personName: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    tabldotTag: {
        alignSelf: 'flex-start',
        backgroundColor: '#3b82f620',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 2,
    },
    tabldotTagText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    mealChip: {
        backgroundColor: colors.background,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    mealChipText: {
        fontSize: 11,
        color: colors.muted,
        fontWeight: '500',
    },
    otherItemText: {
        fontSize: 12,
        color: colors.muted,
        marginTop: 2,
    },
    // Badge'ler
    dokumBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    dokumBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    dokumBadgeOpen: {
        backgroundColor: '#fef3c7',
    },
    dokumBadgePaid: {
        backgroundColor: '#dcfce7',
    },
    dokumBadgePayment: {
        backgroundColor: '#dcfce7',
    },
    dokumBadgeClosing: {
        backgroundColor: '#dbeafe',
    },
    // Finans kartı
    financeCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        overflow: 'hidden',
        marginBottom: 8,
    },
    financeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    financeDate: {
        fontSize: 11,
        color: colors.muted,
        width: 56,
        fontWeight: '600',
    },
    financeLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    financeNote: {
        fontSize: 11,
        color: colors.muted,
        marginTop: 1,
    },
    financeAmount: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text,
        marginLeft: 'auto',
    },
    phoneInputWrapper: {
        flexDirection: 'row',
        marginBottom: 12,
        height: 52,
    },
    prefixBox: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
        paddingHorizontal: 12,
        justifyContent: 'center',
        borderRightWidth: 0,
    },
    prefixText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
    },
    phoneInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        color: colors.text,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});

