import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { adisyonService } from "@/lib/services/adisyonService";
import { userService } from "@/lib/services/userService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function CorporateInfoScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile, loading: profileLoading } = useProfile(user?.id);

    const [activeTab, setActiveTab] = useState<'INFO' | 'EMPLOYEES' | 'DEBTS'>('INFO');
    
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

    // DEBTS State
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const [fetchedCompanyId, setFetchedCompanyId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCompanyId = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase
                .from("companies")
                .select("id")
                .eq("user_id", user.id)
                .single();
            if (data) {
                setFetchedCompanyId(data.id);
            } else if (error) {
                console.error("fetchCompanyId error:", error);
            }
        };
        fetchCompanyId();
    }, [user?.id]);

    const actualCompanyId = fetchedCompanyId || profile?.corporate_info?.id || profile?.company_id;
    const isCompanyOwner = !!profile?.corporate_info;

    useEffect(() => {
        if (!profileLoading && !isCompanyOwner) {
            router.replace("/(tabs)/home");
        }
    }, [profileLoading, isCompanyOwner]);

    useEffect(() => {
        if (profile?.corporate_info) {
            setCompanyName(profile.corporate_info.companyName || "");
            setTaxNumber(profile.corporate_info.taxNumber || "");
            setCompanyPhone(profile.corporate_info.companyPhone || "");
            setInvoiceAddress(profile.corporate_info.invoiceAddress || "");
        }
    }, [profile]);

    useEffect(() => {
        if (activeTab === 'EMPLOYEES' && actualCompanyId) {
            loadEmployees();
        } else if (activeTab === 'DEBTS' && actualCompanyId) {
            loadOrders();
        }
    }, [activeTab, actualCompanyId]);

    const loadEmployees = async () => {
        if (!actualCompanyId) return;
        setEmpLoading(true);
        try {
            const data = await userService.getCompanyEmployees(actualCompanyId);
            setEmployees(data || []);
        } catch (e) {
            console.error(e);
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
        } catch (e) {
            console.error(e);
        } finally {
            setOrdersLoading(false);
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
        if (!newEmpName.trim() || (!isGuest && !newEmpPhone.trim())) {
            return Alert.alert("Hata", "Lütfen gerekli alanları doldurunuz.");
        }

        try {
            setEmpLoading(true);
            await userService.addEmployee(actualCompanyId, newEmpName, isGuest ? "Misafir" : newEmpPhone, isGuest ? "guest" : "customer", true);
            setNewEmpName("");
            setNewEmpPhone("");
            await loadEmployees();
            Alert.alert("Başarılı", isGuest ? "Misafir eklendi." : "Çalışan eklendi.");
        } catch (e: any) {
            Alert.alert("Hata", "Eklenemedi: " + e.message);
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
            const fileString = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
            
            Papa.parse(fileString, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        const parsedEmployees = results.data.map((row: any) => ({
                            fullName: row.Ad || row.Name || row.AdSoyad || "İsimsiz",
                            phone: row.Telefon || row.Phone || ""
                        })).filter(e => e.fullName !== "İsimsiz");

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

    const unpaidOrders = useMemo(() => {
        return orders.filter((o) => !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status));
    }, [orders]);

    const totalDebt = useMemo(() => unpaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0), [unpaidOrders]);

    const generatePdfEkstre = async () => {
        if (unpaidOrders.length === 0) {
            return Alert.alert("Bilgi", "Mevcut borç kaydı bulunmuyor.");
        }

        const dateStr = new Date().toLocaleDateString('tr-TR');
        const tableRows = unpaidOrders.map((o: any) => {
            const d = new Date(o.created_at || o.date);
            const dateFormatted = `${d.toLocaleDateString('tr-TR')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">${dateFormatted}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #ddd;">${o.userName}</td>
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
                    <h2 style="color: #666; font-weight: normal; margin-top: 0;">Firma Borç Ekstresi</h2>
                    <p style="color: #888; font-size: 12px;">Firma: ${companyName}</p>
                    <p style="color: #888; font-size: 12px;">Tarih: ${dateStr}</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
                        <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Toplam Ödenmemiş Borç</p>
                        <h2 style="margin: 10px 0 0 0; color: #e11d48;">${totalDebt > 0 ? `₺${totalDebt.toLocaleString("tr-TR")}` : 'Fiyat Onayı Bekleniyor'}</h2>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                            <tr style="background-color: #f8f9fa; text-align: left;">
                                <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666;">TARIH</th>
                                <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666;">ÇALIŞAN</th>
                                <th style="padding: 12px; border-bottom: 2px solid #ddd; font-weight: bold; font-size: 12px; color: #666;">ÜRÜNLER</th>
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
            if (canShare) await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(error);
            Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
        }
    };


    if (profileLoading) {
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
                <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/home")}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Firma Sahibi</Text>
                </View>
                <ThemeSwitcher />
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
                            <View style={[styles.inputContainer, styles.readOnlyInput]}>
                                <MaterialIcons name="business" size={20} color={colors.muted} />
                                <TextInput style={[styles.input, { color: colors.muted }]} value={companyName} editable={false} />
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Vergi Numarası / TCKN</Text>
                            <View style={[styles.inputContainer, styles.readOnlyInput]}>
                                <MaterialIcons name="tag" size={20} color={colors.muted} />
                                <TextInput style={[styles.input, { color: colors.muted }]} value={taxNumber} editable={false} />
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
                            <TextInput 
                                style={styles.basicInput} 
                                placeholder="Telefon Numarası (Sadece Çalışan İçin)" 
                                placeholderTextColor={colors.muted} 
                                value={newEmpPhone} 
                                onChangeText={setNewEmpPhone} 
                                keyboardType="phone-pad" 
                            />
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
                            <Text style={{ fontSize: 36, fontWeight: '900', color: colors.danger }}>{totalDebt > 0 ? `₺${totalDebt.toLocaleString('tr-TR')}` : 'Fiyat Bekleniyor'}</Text>
                        </View>

                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={generatePdfEkstre}>
                            <MaterialIcons name="picture-as-pdf" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.actionBtnText}>Ekstre PDF İndir / Paylaş</Text>
                        </TouchableOpacity>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Açık Adisyonlar (Çalışanlar)</Text>
                            {ordersLoading ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                            ) : unpaidOrders.length === 0 ? (
                                <Text style={{ color: colors.muted, fontStyle: 'italic', marginVertical: 12 }}>Ödenmemiş adisyon bulunmuyor.</Text>
                            ) : (
                                unpaidOrders.map(order => {
                                    const date = new Date(order.created_at || order.date);
                                    return (
                                        <View key={order.id} style={{ borderBottomWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ fontWeight: 'bold', color: colors.text }}>{order.userName}</Text>
                                            </View>
                                            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>{date.toLocaleString('tr-TR')}</Text>
                                            
                                            {order.adisyon_items?.map((item: any) => (
                                                <View key={item.id} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, width: 24 }}>{item.quantity}x </Text>
                                                    <Text style={{ fontSize: 12, color: colors.muted }}>{item.menu_items?.name || 'Yemek'}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )
                                })
                            )}
                        </View>
                    </View>
                )}

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
    }
});
