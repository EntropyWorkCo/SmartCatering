import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EkstreOnizlemeModal from "@/components/EkstreOnizlemeModal";
import Colors from "@/constants/Colors";
import { ekstreService } from "@/lib/services/ekstreService";
import { pdfService } from "@/lib/services/pdfService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function EkstreListScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [loading, setLoading] = useState(true);
    const [firms, setFirms] = useState<any[]>([]);
    const [selectedFirma, setSelectedFirma] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [ekstreData, setEkstreData] = useState<any>(null);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState("");

    useEffect(() => {
        loadFirms();
    }, []);

    const loadFirms = async () => {
        setLoading(true);
        try {
            // Firmalar ve toplam bakiyelerini çek
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('balance', { ascending: false });

            if (error) throw error;
            setFirms(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEkstre = async (firma: any) => {
        setSelectedFirma(firma);
        setModalVisible(true);
        setEkstreData(null);
        setPdfUri(null);
        setHtmlContent("");

        try {
            // Ayın başından bugüne kadar olan dönemi varsayılan olarak seçiyoruz
            const now = new Date();
            const bitis = now.toISOString().split('T')[0];
            const baslangic = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            
            const data = await ekstreService.getEkstreVerisi(firma.id, baslangic, bitis);
            const html = pdfService.generateEkstreHTML(data);
            
            setEkstreData(data);
            setHtmlContent(html);
            
            // PDF dosyasını arka planda oluştur
            const { uri } = await require('expo-print').printToFileAsync({ html });
            setPdfUri(uri);
        } catch (error) {
            console.error("Ekstre oluşturma hatası:", error);
            setModalVisible(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Firma Ekstre Yönetimi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {firms.map((firma) => {
                    const hasDebt = (firma.balance || 0) > 0;
                    return (
                        <View key={firma.id} style={styles.firmCard}>
                            <View style={styles.firmInfo}>
                                <Text style={styles.firmName}>{firma.company_name}</Text>
                                <Text style={styles.firmMeta}>Son Güncelleme: {firma.last_debt_update ? new Date(firma.last_debt_update).toLocaleDateString('tr-TR') : '-'}</Text>
                            </View>
                            
                            <View style={styles.firmActions}>
                                <View style={[styles.debtBadge, { backgroundColor: hasDebt ? "#fff7ed" : "#f0fdf4", borderColor: hasDebt ? "#fb923c" : "#bbf7d0" }]}>
                                    <Text style={[styles.debtText, { color: hasDebt ? "#ea580c" : "#16803d" }]}>
                                        {hasDebt ? `₺${firma.balance.toLocaleString('tr-TR')} Borç` : 'Borç Yok'}
                                    </Text>
                                </View>
                                
                                <TouchableOpacity 
                                    style={[styles.createBtn, { backgroundColor: colors.primary }]} 
                                    onPress={() => handleCreateEkstre(firma)}
                                >
                                    <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                                    <Text style={styles.createBtnText}>Ekstre Oluştur</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {modalVisible && (
                <EkstreOnizlemeModal 
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    pdfUri={pdfUri}
                    htmlContent={htmlContent}
                    firmaAdi={selectedFirma?.company_name || ""}
                    donemBilgisi={ekstreData ? `${new Date(ekstreData.donem.baslangic).toLocaleDateString('tr-TR')} - ${new Date(ekstreData.donem.bitis).toLocaleDateString('tr-TR')}` : "Hazırlanıyor..."}
                />
            )}
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.surface,
        borderBottomWidth:1,
        borderBottomColor: colors.surfaceBorder
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    list: { padding: 20 },
    firmCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    firmInfo: { marginBottom: 15 },
    firmName: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 4 },
    firmMeta: { fontSize: 12, color: colors.muted },
    firmActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debtBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    debtText: { fontSize: 14, fontWeight: 'bold' },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8
    },
    createBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});
