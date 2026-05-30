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
    const [periodFilter, setPeriodFilter] = useState<'15_DAYS' | 'MONTHLY' | 'YEARLY'>('15_DAYS');
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

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
    const isCompanyOwner = profile?.role === 'owner' || profile?.role === 'corporate';

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
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            
            const data = await ekstreService.getEkstreVerisi(actualCompanyId, firstDay, lastDay);
            const { uri } = await Print.printToFileAsync({ html: pdfService.generateEkstreHTML(data) });
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

    const filteredOrders = useMemo(() => {
        const thresholdDate = new Date();
        if (periodFilter === '15_DAYS') {
            thresholdDate.setDate(thresholdDate.getDate() - 15);
        } else if (periodFilter === 'MONTHLY') {
            thresholdDate.setMonth(thresholdDate.getMonth() - 1);
        } else if (periodFilter === 'YEARLY') {
            thresholdDate.setFullYear(thresholdDate.getFullYear() - 1);
        }

        return orders.filter(o => {
            if (["CANCELLED", "İptal"].includes(o.status)) return false;
            // Manuel kayıtlar her zaman veya en azından bu filtreye takılmadan gelsin istenebilir, 
            // ama şimdilik tarih filtresine uysunlar.
            const orderDate = new Date(o.created_at || o.date);
            return orderDate >= thresholdDate;
        });
    }, [orders, periodFilter]);

    const ordersByMonth = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        
        filteredOrders.forEach(order => {
             const d = new Date(order.created_at || order.date);
             const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
             const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
             
             if (!grouped[key]) grouped[key] = [];
             grouped[key].push(order);
        });
        
        return grouped;
    }, [filteredOrders]);

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

    const generatePdfEkstre = async () => {
        if (filteredOrders.length === 0) {
            return Alert.alert("Bilgi", "Seçili döneme ait sipariş kaydı bulunmuyor.");
        }

        const dateStr = new Date().toLocaleDateString('tr-TR');
        
        // Dönem Başlangıç Tarihi Hesabı
        const thresholdDate = new Date();
        if (periodFilter === '15_DAYS') thresholdDate.setDate(thresholdDate.getDate() - 15);
        else if (periodFilter === 'MONTHLY') thresholdDate.setMonth(thresholdDate.getMonth() - 1);
        else if (periodFilter === 'YEARLY') thresholdDate.setFullYear(thresholdDate.getFullYear() - 1);
        
        const donemAraligi = `${thresholdDate.toLocaleDateString('tr-TR')} - ${dateStr}`;

        let devreden_bakiye = 0;
        let bu_donemin_borcu = 0;

        orders.forEach((o: any) => {
            const d = new Date(o.created_at || o.date);
            const tutar = o.total_amount || 0;
            const statusUpper = (o.status || "").toUpperCase();
            
            const isPaid = ["PAID", "ÖDENDİ", "COMPLETED", "TAMAMLANDI"].includes(statusUpper);
            const isCancelled = ["CANCELLED", "İPTAL"].includes(statusUpper);

            if (isCancelled) return;

            if (d < thresholdDate) {
                if (!isPaid) devreden_bakiye += tutar;
            } else {
                if (!isPaid) bu_donemin_borcu += tutar;
            }
        });

        const guncel_toplam_borc = devreden_bakiye + bu_donemin_borcu;

        const tableRows = filteredOrders.map((o: any) => {
            const d = new Date(o.created_at || o.date);
            const dateFormatted = `${d.toLocaleDateString('tr-TR')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            const isManual = o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT';
            const manualLabel = o.order_type === 'MANUAL_DEBT' ? 'Admin Borç Girişi' : 'Ödeme Kaydı';
            
            const adisyonDetay = o.adisyon_items && o.adisyon_items.length > 0 
                ? o.adisyon_items.map((i: any) => i.menu_items?.name ? `${i.quantity}x ${i.menu_items.name}` : '').filter(Boolean).join(', ') 
                : '';

            const detailText = isManual 
                ? `<strong>${manualLabel}</strong> - ₺${o.total_amount?.toLocaleString('tr-TR')} <br/><small style="color:#64748b;">(${o.order_type === 'MANUAL_DEBT' ? 'Dönem' : 'Tarih'}: ${o.note || ''})</small>` 
                : `Hizmet: ${o.userName} - ${adisyonDetay || 'Sipariş Detayı'}`;

            return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; width: 120px; color: #64748b;">${dateFormatted}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 500;">✔️ ${detailText}</td>
                </tr>
            `;
        }).join('');

        const html = `
    <html>
    <body style="margin: 0; padding: 40px; font-family: Helvetica, Arial, sans-serif; color: #1e293b;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;">
            <div style="flex: 1;">
                <div style="background: ${colors.primary}; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-style: italic; display: inline-block; font-size: 20px; margin-bottom: 8px;">MEYDAN LOKANTA</div>
            </div>
            <div style="flex: 1; text-align: right;">
                <h1 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase;">MÜŞTERİ HESAP ÖZETİ</h1>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Seçili Dönem: <strong>${donemAraligi}</strong></div>
            </div>
        </div>

        <!-- YENİ ÜST KISIM (ÖZET & TOPLAM BORÇ) -->
        <div style="margin-bottom: 40px;">
            <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Müşteri: ${companyName}</div>
            
            <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr>
                    <td style="padding: 12px 20px; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0;">Geçmişten Devreden Borç <em>(Dönem Öncesi)</em></td>
                    <td style="padding: 12px 20px; font-size: 14px; font-weight: bold; text-align: right; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${devreden_bakiye.toLocaleString('tr-TR')} TL</td>
                </tr>
                <tr>
                    <td style="padding: 12px 20px; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0;">Bu Dönemin Borcu <em>(${donemAraligi})</em></td>
                    <td style="padding: 12px 20px; font-size: 14px; font-weight: bold; text-align: right; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${bu_donemin_borcu.toLocaleString('tr-TR')} TL</td>
                </tr>
                <tr style="background: #eef2ff;">
                    <td style="padding: 16px 20px; font-size: 16px; font-weight: 900; color: #dc2626;">🔴 GÜNCEL TOPLAM BORCUNUZ</td>
                    <td style="padding: 16px 20px; font-size: 20px; font-weight: 900; text-align: right; color: #dc2626;">${guncel_toplam_borc.toLocaleString('tr-TR')} TL</td>
                </tr>
            </table>
        </div>

        <!-- ALT KISIM (TÜKETİM DETAYLARI) -->
        <div>
            <h2 style="font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                Seçili Dönemde (${donemAraligi}) Alınan Hizmetler / Detaylar:
            </h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 60px; padding-top: 30px; border-top: 2px solid #f1f5f9; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
            <div style="font-style: italic;">Bu belge sistem tarafından otomatik oluşturulmuştur. Döküman Tarihi: ${dateStr}</div>
            <div style="font-weight: 700; color: #64748b;">Meydan Lokanta</div>
        </div>
    </body>
    </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(error);
            Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
        }
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
                <TouchableOpacity style={styles.backBtn} onPress={() => { Keyboard.dismiss(); router.push("/profile"); }}>
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
                    <View style={{ gap: 24 }}>
                        <View style={[styles.sectionCard, { alignItems: 'center', backgroundColor: colors.dangerBg, borderColor: colors.danger, borderWidth: 1 }]}>
                            <Text style={{ fontSize: 12, color: colors.danger, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' }}>Toplam Ödenmemiş Borç</Text>
                            <Text style={{ fontSize: 36, fontWeight: '900', color: colors.danger }}>{adminDebt > 0 ? `₺${adminDebt.toLocaleString('tr-TR')}` : 'Borç Bulunmuyor'}</Text>
                        </View>

                        {/* Ay Kapanışı admin panelinde yapılır */}
                        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <MaterialIcons name="info-outline" size={16} color={colors.muted} />
                            <Text style={{ flex: 1, fontSize: 11, color: colors.muted }}>Ay kapanışı Admin panelinden yapılır.</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                            onPress={handleDownloadEkstre}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialIcons name="picture-as-pdf" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.actionBtnText}>Hesap Ekstresini İndir (PDF)</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.sectionCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Sipariş Dökümü</Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <TouchableOpacity onPress={() => setPeriodFilter('15_DAYS')} style={[styles.periodTab, periodFilter === '15_DAYS' && styles.periodTabActive]}>
                                    <Text style={[styles.periodTabText, periodFilter === '15_DAYS' && styles.periodTabTextActive]}>15 Gün</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setPeriodFilter('MONTHLY')} style={[styles.periodTab, periodFilter === 'MONTHLY' && styles.periodTabActive]}>
                                    <Text style={[styles.periodTabText, periodFilter === 'MONTHLY' && styles.periodTabTextActive]}>Aylık</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setPeriodFilter('YEARLY')} style={[styles.periodTab, periodFilter === 'YEARLY' && styles.periodTabActive]}>
                                    <Text style={[styles.periodTabText, periodFilter === 'YEARLY' && styles.periodTabTextActive]}>Yıllık</Text>
                                </TouchableOpacity>
                            </View>

                            {ordersLoading ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                            ) : filteredOrders.length === 0 ? (
                                <Text style={{ color: colors.muted, fontStyle: 'italic', marginVertical: 12 }}>Seçili döneme ait sipariş bulunmuyor.</Text>
                            ) : (
                                Object.entries(ordersByMonth).map(([monthKey, monthOrders]) => {
                                    const isExpanded = expandedMonths[monthKey] || false;
                                    return (
                                        <View key={monthKey} style={{ marginBottom: 12 }}>
                                            <TouchableOpacity 
                                                onPress={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isExpanded }))}
                                                activeOpacity={0.7}
                                                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: isExpanded ? colors.primary + '80' : colors.surfaceBorder }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <MaterialIcons name="date-range" size={20} color={isExpanded ? colors.primary : colors.muted} />
                                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: isExpanded ? colors.primary : colors.text }}>{monthKey}</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={{ fontSize: 12, color: colors.muted, fontWeight: 'bold' }}>{monthOrders.length} Sipariş</Text>
                                                    <MaterialIcons name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={colors.muted} />
                                                </View>
                                            </TouchableOpacity>

                                            {isExpanded && (
                                                <View style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.surfaceBorder, marginTop: -2 }}>
                                                    {monthOrders.map((order: any) => {
                                                        const date = new Date(order.created_at || order.date);
                                                        return (
                                                            <View key={order.id} style={{ borderBottomWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 12 }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <Text style={{ fontWeight: 'bold', color: colors.text }}>
                                                                        {order.order_type === 'MANUAL_DEBT' ? 'Kayıtlı Borç' : order.order_type === 'MANUAL_PAYMENT' ? 'Kayıtlı Ödeme' : order.userName}
                                                                    </Text>
                                                                </View>
                                                                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>{date.toLocaleString('tr-TR')}</Text>
                                                                
                                                                {order.order_type?.startsWith('MANUAL') ? (
                                                                    <View style={{ backgroundColor: colors.background, padding: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Text style={{ fontSize: 12, color: colors.text, flex: 1, marginRight: 8 }}>
                                                                            <Text style={{ fontWeight: 'bold', color: colors.muted }}>{order.order_type === 'MANUAL_DEBT' ? 'Dönem:' : 'Tarih:'}</Text> {order.note}
                                                                        </Text>
                                                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: order.order_type === 'MANUAL_PAYMENT' ? '#4CAF50' : colors.primary }}>
                                                                            ₺{order.total_amount?.toLocaleString("tr-TR")}
                                                                        </Text>
                                                                    </View>
                                                                ) : (
                                                                    order.adisyon_items?.map((item: any) => (
                                                                        <View key={item.id} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, width: 24 }}>{item.quantity}x </Text>
                                                                            <Text style={{ fontSize: 12, color: colors.muted }}>{item.menu_items?.name || 'Yemek'}</Text>
                                                                        </View>
                                                                    ))
                                                                )}
                                                            </View>
                                                        )
                                                    })}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
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
