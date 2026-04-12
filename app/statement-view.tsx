import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { adisyonService } from "@/lib/services/adisyonService";
import { pdfService } from "@/lib/services/pdfService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function StatementViewScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile } = useProfile(user?.id);

    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date());
    const [unitPrice, setUnitPrice] = useState("0");
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!unitPrice || Number(unitPrice) <= 0) {
            Alert.alert("Uyarı", "Lütfen geçerli bir birim fiyat giriniz.");
            return;
        }

        try {
            setGenerating(true);
            
            // 1. Get company info
            // 1. Get company info
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', profile?.company_id || '')
                .single();
            
            let companyInfo = company;
            if (companyError || !companyInfo) {
                // Try owner check
                const { data: ownerCompany } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('user_id', user?.id || '')
                    .single();
                
                if (!ownerCompany) throw new Error("Firma bilgisi bulunamadı.");
                companyInfo = ownerCompany;
            }

            // 2. Fetch orders
            const orders = await adisyonService.getCompanyOrders(companyInfo.id);
            
            // 3. Filter by date
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            const filteredOrders = orders.filter((o: any) => {
                const d = new Date(o.created_at).toISOString().split('T')[0];
                return d >= startStr && d <= endStr && !["CANCELLED", "İPTAL"].includes(o.status?.toUpperCase());
            });

            // 4. Prepare PDF data
            const reportData = {
                firma_adi: companyInfo.company_name,
                vkn: companyInfo.tax_number || "-",
                firma_adres: companyInfo.address || "Kayıtlı Adres",
                firma_telefon: companyInfo.company_phone || "-",
                ekstre_no: Math.floor(1000 + Math.random() * 9000).toString(),
                donem_araligi: `${startDate.toLocaleDateString('tr-TR')} - ${endDate.toLocaleDateString('tr-TR')}`,
                dokuman_tarihi: new Date().toLocaleDateString('tr-TR'),
                birim_fiyat: Number(unitPrice),
                odeme_durumu: 'BEKLIYOR' as const,
                islemler: filteredOrders.flatMap((o: any) => {
                    const items = o.adisyon_items || [];
                    if (items.length === 0) {
                        return [{
                            tarih: new Date(o.created_at).toLocaleDateString('tr-TR'),
                            saat: new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                            yemek_adi: o.order_type === 'MANUAL_DEBT' ? (o.note || 'Genel Tüketim') : 'Yemek Hizmeti',
                            kisi_sayisi: 1
                        }];
                    }
                    return items.map((item: any) => ({
                        tarih: new Date(o.created_at).toLocaleDateString('tr-TR'),
                        saat: new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                        yemek_adi: item.menu_items?.name || 'Yemek',
                        kisi_sayisi: item.quantity || 1
                    }));
                })
            };

            await pdfService.generateCompanyReport(reportData);
            Alert.alert("Başarılı", "Ekstre oluşturuldu ve paylaşmaya hazır.");
        } catch (err: any) {
            Alert.alert("Hata", err.message || "Ekstre oluşturulurken bir hata oluştu.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Hesap Ekstresi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Ekstre Parametreleri</Text>
                    <Text style={styles.cardSub}>Seçtiğiniz tarih aralığındaki tüm tüketimler otomatik hesaplanacaktır.</Text>

                    <Text style={styles.label}>Birim Yemek Fiyatı (₺)</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="payments" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            value={unitPrice}
                            onChangeText={setUnitPrice}
                            keyboardType="numeric"
                            placeholder="Örn: 150"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Başlangıç</Text>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
                                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                                <Text style={styles.dateText}>{startDate.toLocaleDateString('tr-TR')}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Bitiş</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
                                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                                <Text style={styles.dateText}>{endDate.toLocaleDateString('tr-TR')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            onChange={(e, date) => {
                                setShowStartPicker(false);
                                if (date) setStartDate(date);
                            }}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            onChange={(e, date) => {
                                setShowEndPicker(false);
                                if (date) setEndDate(date);
                            }}
                        />
                    )}

                    <TouchableOpacity 
                        style={[styles.generateBtn, { backgroundColor: generating ? colors.muted : colors.primary }]} 
                        onPress={handleGenerate}
                        disabled={generating}
                    >
                        {generating ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <MaterialIcons name="picture-as-pdf" size={24} color="#fff" />
                                <Text style={styles.generateBtnText}>EKSTRE OLUŞTUR VE PAYLAŞ</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
                    <MaterialIcons name="info" size={20} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                        Oluşturulan PDF dosyası A4 boyutunda, şirket logonuz ve detaylı döküm ile birlikte hazırlanacaktır.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backBtn: { padding: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    content: { padding: 24 },
    card: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.surfaceBorder, gap: 16 },
    cardTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    cardSub: { fontSize: 13, color: colors.muted, marginBottom: 8 },
    label: { fontSize: 12, fontWeight: 'bold', color: colors.muted, marginBottom: -8, marginLeft: 4 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.background, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, height: 56
    },
    input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
    dateRow: { flexDirection: 'row', gap: 16 },
    dateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.background, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, height: 56
    },
    dateText: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    generateBtn: {
        height: 64, borderRadius: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
    },
    generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
    infoBox: { flexDirection: 'row', gap: 12, padding: 20, borderRadius: 20, marginTop: 24 },
    infoText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 }
});
