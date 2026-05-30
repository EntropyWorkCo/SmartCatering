import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from 'expo-print';
import { router, useFocusEffect } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminReports() {
    const { orders } = useAdisyon();
    const insets = useSafeAreaInsets();
    const [view, setView] = useState<"MAIN" | "SALES" | "STATS" | "FEEDBACK">(
        "MAIN"
    );

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const [ratings, setRatings] = useState<any[]>([]);
    const [loadingRatings, setLoadingRatings] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            const fetchRatings = async () => {
                const { data, error } = await supabase
                    .from("feedbacks")
                    .select("*, users(full_name, companies!users_company_id_fkey(company_name))")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching ratings:", error);
                }

                if (data) {
                    const formatted = data.map((r: any) => {
                        const user = r.users?.[0] || r.users;
                        const company = user?.["companies!users_company_id_fkey"]?.[0] || user?.["companies!users_company_id_fkey"] || user?.companies?.[0] || user?.companies;

                        let parsedNote = r.note || '';
                        let parsedDetails = r.rating_details;

                        if (r.note && typeof r.note === 'string' && r.note.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(r.note);
                                if (parsed && typeof parsed.text !== 'undefined') {
                                    parsedNote = parsed.text;
                                    parsedDetails = parsed.details || r.rating_details;
                                }
                            } catch(e) {}
                        }

                        return {
                            id: r.id,
                            userName: user?.full_name || 'Müşteri',
                            company: company?.company_name || 'Bireysel',
                            generalStars: r.rating,
                            rating_details: parsedDetails,
                            note: parsedNote,
                            date: new Date(r.created_at).toLocaleDateString('tr-TR'),
                            adisyon_id: r.order_id,
                            type: r.type
                        };
                    });
                    setRatings(formatted);
                }
                setLoadingRatings(false);
            };
            fetchRatings();
        }, [])
    );

    if (view === "SALES")
        return <DailySalesView onBack={() => setView("MAIN")} orders={orders} colors={colors} styles={styles} />;
    if (view === "STATS")
        return <PerformanceDashboard onBack={() => setView("MAIN")} ratings={ratings} colors={colors} styles={styles} />;
    if (view === "FEEDBACK")
        return <FeedbackView onBack={() => setView("MAIN")} ratings={ratings} colors={colors} styles={styles} />;

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Raporlar & Analiz</Text>
                </View>
            </View>

            <Text style={styles.sectionHeader}>SİSTEM ÖZETLERİ</Text>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.menuContainer}>
                    <ReportMenuItem
                        icon="insights"
                        label="Günlük Satış Özeti"
                        subtitle="Günün toplam cirosu ve menü dağılımı."
                        onClick={() => setView("SALES")}
                        colors={colors}
                        styles={styles}
                    />
                    <ReportMenuItem
                        icon="star"
                        label="Müşteri Geri Bildirimleri"
                        subtitle={`Ortalama: ${ratings.filter(r => r.generalStars > 0).length > 0 ? (ratings.filter(r => r.generalStars > 0).reduce((acc, r) => acc + (r.generalStars || 0), 0) / ratings.filter(r => r.generalStars > 0).length).toFixed(1) : "5.0"} | ${ratings.length} Yorum`}
                        onClick={() => setView("FEEDBACK")}
                        colors={colors}
                        styles={styles}
                    />
                    <ReportMenuItem
                        icon="query-stats"
                        label="Performans Analizi"
                        subtitle="Mutfak başarısı ve kategori skorları."
                        onClick={() => setView("STATS")}
                        isLast
                        colors={colors}
                        styles={styles}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const ReportMenuItem = ({ icon, label, subtitle, onClick, isLast, colors, styles }: any) => (
    <TouchableOpacity
        style={[styles.menuItem, !isLast && styles.menuItemBorder]}
        onPress={onClick}
        activeOpacity={0.7}
    >
        <View style={styles.menuItemLeft}>
            <View style={styles.menuItemIcon}>
                <MaterialIcons name={icon} size={24} color={colors.primary} />
            </View>
            <View>
                <Text style={styles.menuItemLabel}>{label}</Text>
                <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
            </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </TouchableOpacity>
);

const DailySalesView = ({ onBack, orders, colors, styles }: any) => {
    const insets = useSafeAreaInsets();
    const [mainTab, setMainTab] = useState<"KURUMSAL" | "BIREYSEL">("KURUMSAL");
    const [filterPeriod, setFilterPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "15_DAYS" | "YEARLY">("15_DAYS");

    useEffect(() => {
        if (mainTab === "KURUMSAL") {
            setFilterPeriod("MONTHLY");
        } else {
            setFilterPeriod("DAILY");
        }
    }, [mainTab]);

    const stats = useMemo(() => {
        const validOrders = orders.filter((o: any) => {
            const statusUpper = (o.status || "").toUpperCase();
            return !["CANCELLED", "İPTAL"].includes(statusUpper);
        });

        const now = new Date();
        const filtered = validOrders.filter((o: any) => {
            const isCorporate = o.isCorporate || !!o.companyName;
            const matchTab = (mainTab === "KURUMSAL" && isCorporate) || (mainTab === "BIREYSEL" && !isCorporate);
            if (!matchTab) return false;

            const orderDate = new Date(o.created_at);

            if (filterPeriod === "DAILY") {
                return orderDate.toDateString() === now.toDateString();
            } else if (filterPeriod === "WEEKLY") {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return orderDate >= weekAgo;
            } else if (filterPeriod === "MONTHLY") {
                return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
            } else if (filterPeriod === "15_DAYS") {
                const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
                return orderDate >= fifteenDaysAgo;
            } else if (filterPeriod === "YEARLY") {
                return orderDate.getFullYear() === now.getFullYear();
            }
            return true;
        });

        const mealsCount = filtered.reduce((acc: number, o: any) => {
            const itemQty = o.adisyon_items?.reduce((iqAcc: number, item: any) => iqAcc + (item.quantity || 0), 0) || 0;
            return acc + itemQty;
        }, 0);

        const revenue = filtered.reduce((acc: number, curr: any) => {
            // Kurumsal ise sadece MANUEL_DEBT ciroyu oluşturur
            if (mainTab === "KURUMSAL") {
                if (curr.order_type === 'MANUAL_DEBT') {
                    return acc + (curr.total_amount || 0);
                }
                return acc;
            }
            // Bireysel ise her şey cirodur
            return acc + (curr.total_amount || 0);
        }, 0);

        return { revenue, count: mealsCount, orders: filtered };
    }, [orders, mainTab, filterPeriod]);

    const [expandedCompanies, setExpandedCompanies] = useState<{ [key: string]: boolean }>({});
    const [companies, setCompanies] = useState<any[]>([]);

    useEffect(() => {
        const fetchCompanies = async () => {
            const { data } = await supabase.from("companies").select("*");
            if (data) setCompanies(data);
        };
        fetchCompanies();
    }, []);

    const groupedOrders = useMemo(() => {
        if (mainTab !== "KURUMSAL") return { "Bireysel": stats.orders };

        const groups: { [key: string]: any[] } = {};
        stats.orders.forEach((o: any) => {
            const user = o.users?.[0] || o.users;
            const matchCompany = companies.find((c: any) => c.user_id === o.user_id || c.id === user?.company_id);
            const name = matchCompany ? matchCompany.company_name : (o.companyName || "Bireysel");
            if (!groups[name]) groups[name] = [];
            groups[name].push({ 
                ...o, 
                isOwner: matchCompany?.user_id === o.user_id,
                companyBalance: matchCompany?.balance || 0 
            });
        });
        return groups;
    }, [stats.orders, mainTab, companies]);

    const toggleCompany = (name: string) => {
        setExpandedCompanies(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const generatePdf = async () => {
        if (stats.orders.length === 0) {
            Alert.alert("Hata", "PDF oluşturulacak veri bulunamadı.");
            return;
        }

        const dateStr = new Date().toLocaleDateString('tr-TR');
        const now = new Date();
        let startD = new Date();
        let periodName = "";
        
        if (filterPeriod === "DAILY") { periodName = "Günlük"; startD = now; }
        else if (filterPeriod === "WEEKLY") { periodName = "Haftalık"; startD = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }
        else if (filterPeriod === "MONTHLY") { periodName = "Aylık"; startD = new Date(now.getFullYear(), now.getMonth(), 1); }
        else if (filterPeriod === "15_DAYS") { periodName = "15 Günlük"; startD = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); }
        else if (filterPeriod === "YEARLY") { periodName = "Yıllık"; startD = new Date(now.getFullYear(), 0, 1); }
        
        const dateRangeStr = `${startD.toLocaleDateString('tr-TR')} - ${now.toLocaleDateString('tr-TR')}`;

        const groups = groupedOrders as any;
        const groupHtml = Object.keys(groups).map(companyName => {
            const items = groups[companyName];
            const compMeals = items.reduce((acc: number, o: any) => acc + (o.adisyon_items?.reduce((iq: number, i: any) => iq + (i.quantity || 0), 0) || 0), 0);
            
            // Seçili tarihler altındaki şirket tüketim toplamı (Ödenmiş/Ödenmemiş hepsi)
            const compTotal = items.reduce((acc: number, o: any) => acc + (o.total_amount || 0), 0);

            const companyDebt = items[0]?.companyBalance || 0;

            const getLocalizedStatus = (status: string) => {
                const s = (status || "").toUpperCase();
                if (["PAID", "ÖDENDİ", "ÖDENDI"].includes(s)) return "ÖDENDİ";
                if (["COMPLETED", "TAMAMLANDI"].includes(s)) return "TAMAMLANDI";
                if (["CANCELLED", "İPTAL"].includes(s)) return "İPTAL";
                if (["READY", "YOLDA", "HAZIR"].includes(s)) return "YOLDA";
                if (["PREPARING", "HAZIRLANIYOR"].includes(s)) return "HAZIRLANIYOR";
                return "BEKLİYOR";
            };

            const groupedMap: { [key: string]: any } = {};
            items.forEach((o: any) => {
                // Manuel girilen hizmet bedellerini ve borçları dökümden gizliyoruz
                if (o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT') return;
                
                const dateKey = new Date(o.created_at).toLocaleDateString('tr-TR');
                const userKey = o.userName || 'Müşteri';
                const key = `${dateKey}_${userKey}`;

                if (!groupedMap[key]) {
                    groupedMap[key] = { ...o, count: 1, items: [...(o.adisyon_items || [])] };
                } else {
                    groupedMap[key].count += 1;
                    if (o.adisyon_items) groupedMap[key].items.push(...o.adisyon_items);
                }
            });

            const rows = Object.values(groupedMap).map((o: any) => {
                const itemDetails = o.items?.map((i: any) => i.menu_items?.name).join(', ') || 'Hizmet';
                
                return `
                <tr>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">#${o.id.toString().substring(0, 8)}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                        <strong>${o.userName || 'Müşteri'}</strong> ${o.count > 1 ? `<span style="color:${colors.primary}; font-weight:bold;">(x${o.count})</span>` : ''}<br/>
                        <span style="color: #64748b; font-size: 9px;">${itemDetails}</span>
                    </td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                </tr>
            `}).join('');

            return `
                <div style="margin-bottom: 40px; page-break-inside: avoid;">
                    <div style="background-color: #f8fafc; border-left: 5px solid ${colors.primary}; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; color: #1e293b; font-size: 18px;">${companyName}</h2>
                        <div style="display: flex; gap: 20px; text-align: right;">
                             ${mainTab === "KURUMSAL" ? `
                             <div style="border-left: 1px solid #e2e8f0; padding-left: 20px;">
                                 <div style="font-size: 10px; color: ${companyDebt <= 0 ? '#10b981' : '#ef4444'}; text-transform: uppercase; font-weight: bold;">${companyDebt <= 0 ? 'BORÇ DURUMU' : 'GÜNCEL BORÇ'}</div>
                                 <div style="font-size: 16px; color: ${companyDebt <= 0 ? '#10b981' : '#ef4444'}; font-weight: 900;">${companyDebt <= 0 ? 'ÖDENDİ' : `₺${companyDebt.toLocaleString("tr-TR")}`}</div>
                             </div>
                             ` : `
                             <div>
                                 <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold;">DÖNEM TÜKETİMİ</div>
                                 <div style="font-size: 16px; color: ${colors.primary}; font-weight: 900;">₺${compTotal.toLocaleString("tr-TR")}</div>
                             </div>
                             `}
                        </div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left;">
                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 10px; color: #64748b; text-transform: uppercase;">ID</th>
                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 10px; color: #64748b; text-transform: uppercase;">KİŞİ & SİPARİŞ DETAYI</th>
                                <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 10px; color: #64748b; text-transform: uppercase;">TARİH</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        const html = `
            <!DOCTYPE html>
            <html>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
                        <div>
                            <div style="background: ${colors.primary}; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-style: italic; display: inline-block; font-size: 20px; margin-bottom: 8px;">MEYDAN LOKANTA</div>
                            <p style="margin: 0; color: #64748b; font-size: 14px; font-weight: bold;">Satış & Tahsilat Raporu</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; color: #64748b;">Tarih Aralığı: <strong style="color: #1e293b;">${dateRangeStr}</strong></div>
                            <div style="font-size: 12px; color: #64748b;">Rapor Türü: <strong style="color: #1e293b;">${mainTab} - ${periodName}</strong></div>
                            <div style="font-size: 12px; color: #64748b;">Oluşturuldu: <strong style="color: #1e293b;">${dateStr}</strong></div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 20px; margin-bottom: 50px;">
                        <div style="background: ${colors.primary}08; padding: 25px; border-radius: 16px; flex: 1; border: 1px solid ${colors.primary}15;">
                            <div style="font-size: 11px; color: ${colors.primary}; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; margin-bottom: 10px;">DÖNEM CİROSU</div>
                            <div style="font-size: 32px; font-weight: 900; color: #1e293b;">₺${stats.revenue.toLocaleString("tr-TR")}</div>
                            <div style="font-size: 10px; color: #64748b; margin-top: 5px;">Seçili dönemdeki <strong>tüm</strong> tüketimlerin kümülatif toplamı.</div>
                        </div>
                        <div style="background: #f8fafc; padding: 25px; border-radius: 16px; flex: 1; border: 1px solid #e2e8f0;">
                            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; margin-bottom: 10px;">TOPLAM ÖĞÜN</div>
                            <div style="font-size: 32px; font-weight: 900; color: #1e293b;">${stats.count} <span style="font-size: 16px; color: #64748b;">Adet</span></div>
                            <div style="font-size: 10px; color: #64748b; margin-top: 5px;">Bu dönemde servis edilen toplam miktar.</div>
                        </div>
                    </div>

                    ${groupHtml}

                    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 10px;">
                        Bu belge Meydan Lokanta İşletme Otomasyonu tarafından otomatik olarak oluşturulmuştur.<br/>
                        &copy; ${new Date().getFullYear()} Meydan Lokanta | Tüm Hakları Saklıdır.
                    </div>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Hata", "PDF oluşturulurken bir sorun oluştu.");
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Satış Özeti</Text>
                </View>
                <TouchableOpacity onPress={generatePdf} style={styles.exportPdfButton}>
                    <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
                    <Text style={styles.exportPdfText}>İNDİR</Text>
                </TouchableOpacity>
            </View>

            {/* Main Tabs (Kurumsal vs Bireysel) */}
            <View style={{ flexDirection: "row", marginHorizontal: 24, marginBottom: 12, backgroundColor: colors.surfaceBorder, padding: 4, borderRadius: 12 }}>
                <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 }, mainTab === "KURUMSAL" && { backgroundColor: colors.surface }]}
                    onPress={() => setMainTab("KURUMSAL")}
                >
                    <Text style={[{ fontSize: 13, fontWeight: "bold", color: colors.muted }, mainTab === "KURUMSAL" && { color: colors.text }]}>KURUMSAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 }, mainTab === "BIREYSEL" && { backgroundColor: colors.surface }]}
                    onPress={() => setMainTab("BIREYSEL")}
                >
                    <Text style={[{ fontSize: 13, fontWeight: "bold", color: colors.muted }, mainTab === "BIREYSEL" && { color: colors.text }]}>BİREYSEL</Text>
                </TouchableOpacity>
            </View>

            {/* Sub Filter Tabs */}
            <View style={styles.filterTabsContainer}>
                {mainTab === "BIREYSEL" && (
                    <>
                        <TouchableOpacity style={[styles.filterTab, filterPeriod === "DAILY" && styles.filterTabActive]} onPress={() => setFilterPeriod("DAILY")}>
                            <Text style={[styles.filterTabText, filterPeriod === "DAILY" && styles.filterTabTextActive]}>Günlük</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.filterTab, filterPeriod === "WEEKLY" && styles.filterTabActive]} onPress={() => setFilterPeriod("WEEKLY")}>
                            <Text style={[styles.filterTabText, filterPeriod === "WEEKLY" && styles.filterTabTextActive]}>Haftalık</Text>
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity style={[styles.filterTab, filterPeriod === "MONTHLY" && styles.filterTabActive]} onPress={() => setFilterPeriod("MONTHLY")}>
                    <Text style={[styles.filterTabText, filterPeriod === "MONTHLY" && styles.filterTabTextActive]}>Aylık</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterTab, filterPeriod === "YEARLY" && styles.filterTabActive]} onPress={() => setFilterPeriod("YEARLY")}>
                    <Text style={[styles.filterTabText, filterPeriod === "YEARLY" && styles.filterTabTextActive]}>Yıllık</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: colors.infoBg, borderColor: colors.info }]}>
                        <Text style={[styles.statBoxLabel, { color: colors.info }]}>DÖNEM CİROSU</Text>
                        <Text style={styles.statBoxValue}>₺{stats.revenue.toLocaleString("tr-TR")}</Text>
                        {mainTab === "KURUMSAL" && (
                            <Text style={{ fontSize: 9, color: colors.muted, marginTop: 4 }}>
                                Kurumsal ciro, girilen manuel borçlar üzerinden hesaplanır.
                            </Text>
                        )}
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.cardHighlight, borderColor: colors.primary }]}>
                        <Text style={[styles.statBoxLabel, { color: colors.primary }]}>ÖĞÜN SAYISI</Text>
                        <Text style={styles.statBoxValue}>{stats.count} Adet</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>BU DÖNEMKİ İŞLEMLER</Text>

                {Object.keys(groupedOrders).length > 0 ? (
                    Object.keys(groupedOrders).map((companyName) => {
                        const items = (groupedOrders as any)[companyName];
                        const isOpen = expandedCompanies[companyName];
                        const ownerItem = items.find((o: any) => o.isOwner);
                        const distinctEmps = Array.from(new Set(items.map((o: any) => o.userName || 'Müşteri'))).length;
                        const companyDebt = items[0]?.companyBalance || 0;
                        
                        const compMeals = items.reduce((acc: number, o: any) => acc + (o.adisyon_items?.reduce((iq: number, i: any) => iq + (i.quantity || 0), 0) || 0), 0);
                        const compTotal = items.reduce((acc: number, o: any) => acc + (o.total_amount || 0), 0);

                        return (
                            <View key={companyName} style={{ marginBottom: 12 }}>
                                {mainTab === "KURUMSAL" ? (
                                    <TouchableOpacity 
                                        style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        onPress={() => toggleCompany(companyName)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flex: 1, paddingRight: 16 }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{companyName}</Text>
                                            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: 'bold', marginTop: 4 }}>
                                                {distinctEmps} Çalışan | Dönem Cirosu: ₺{compTotal.toLocaleString("tr-TR")}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                {companyDebt <= 0 ? (
                                                    <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: 'bold' }}>Borç Ödendi</Text>
                                                ) : (
                                                    <>
                                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>₺{companyDebt.toLocaleString("tr-TR")}</Text>
                                                        <Text style={{ fontSize: 10, color: colors.muted, fontWeight: 'bold', marginTop: 4 }}>TOPLAM BORÇ</Text>
                                                    </>
                                                )}
                                            </View>
                                            <MaterialIcons name={isOpen ? "expand-less" : "expand-more"} size={24} color={colors.text} style={{ marginLeft: 12 }} />
                                        </View>
                                    </TouchableOpacity>
                                ) : null}

                                {(isOpen || mainTab === "BIREYSEL") && (
                                    <View style={{ marginTop: mainTab === "KURUMSAL" ? 8 : 0, paddingLeft: mainTab === "KURUMSAL" ? 8 : 0 }}>
                                        {(() => {
                                            if (mainTab !== "KURUMSAL") {
                                                return items.map((o: any) => (
                                                    <View key={o.id} style={[styles.orderCard, { marginBottom: 8, padding: 16 }]}>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                                <Text style={[styles.orderName, { marginBottom: 0 }]}>{o.userName || 'Müşteri'}</Text>
                                                            </View>
                                                            <Text style={styles.orderIdLabel}>Sipariş #${String(o.id).substring(0, 8)}</Text>
                                                            {o.adisyon_items && (
                                                                <View style={{ marginTop: 6 }}>
                                                                    {o.adisyon_items.map((item: any, idx: number) => (
                                                                        <Text key={idx} style={{ fontSize: 11, color: colors.muted }}>
                                                                            • {item.quantity}x {item.menu_items?.name || 'Ürün'}
                                                                        </Text>
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={{ alignItems: "flex-end", justifyContent: 'center' }}>
                                                            <Text style={[styles.orderTotal, { fontSize: 14 }]}>₺{o.total_amount?.toLocaleString("tr-TR")}</Text>
                                                            <Text style={[styles.orderTime, ["PAID", "ÖDENDI", "ÖDENDİ", "TAMAMLANDI"].includes(String(o.status).toUpperCase()) && { color: "#10b981" }]}>
                                                                {String(o.status).toUpperCase() === 'PAID' ? 'ÖDENDİ' : 
                                                                 String(o.status).toUpperCase() === 'READY' ? 'YOLDA' :
                                                                 String(o.status).toUpperCase() === 'COMPLETED' ? 'TAMAMLANDI' : o.status}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ));
                                            }

                                            const subGroups: { [key: string]: any } = {};
                                            items.forEach((o: any) => {
                                                const uName = o.userName || 'Müşteri';
                                                if (!subGroups[uName]) {
                                                    subGroups[uName] = { userName: uName, isOwner: o.isOwner, meals: [] };
                                                } else if (o.isOwner) { subGroups[uName].isOwner = true; }
                                                if (o.adisyon_items) {
                                                    subGroups[uName].meals.push(...o.adisyon_items);
                                                }
                                            });

                                            const sortedEmps = Object.values(subGroups).sort((a: any, b: any) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0));

                                            return sortedEmps.map((emp: any, idx: number) => (
                                                <View key={idx} style={[styles.orderCard, { marginBottom: 8, padding: 16 }]}>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                            <Text style={[styles.orderName, { marginBottom: 0 }]}>{emp.userName}</Text>
                                                            {emp.isOwner ? (
                                                                <View style={{ backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.info, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                                                                    <Text style={{ color: colors.info, fontSize: 8, fontWeight: '900' }}>FİRMA SAHİBİ</Text>
                                                                </View>
                                                            ) : null}
                                                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '900', marginLeft: 'auto' }}>{emp.meals.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)} Öğün</Text>
                                                        </View>
                                                        
                                                        <View style={{ marginTop: 6 }}>
                                                            {(() => {
                                                                const aggItems: { [key: string]: number } = {};
                                                                emp.meals.forEach((i: any) => {
                                                                    const iName = i.menu_items?.name || 'Ürün';
                                                                    aggItems[iName] = (aggItems[iName] || 0) + (i.quantity || 0);
                                                                });
                                                                return Object.keys(aggItems).map((iName, iIdx) => (
                                                                    <Text key={iIdx} style={{ fontSize: 11, color: colors.muted }}>
                                                                        • {aggItems[iName]}x {iName}
                                                                    </Text>
                                                                ));
                                                            })()}
                                                        </View>
                                                    </View>
                                                </View>
                                            ));
                                        })()}
                                    </View>
                                )}
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="trending-flat" size={48} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Bu dönemde satış bulunmuyor</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const PerformanceDashboard = ({ onBack, ratings, colors, styles }: any) => {
    const insets = useSafeAreaInsets();

    const validRatings = ratings.filter((r: any) => r.generalStars > 0);
    const avgScore = validRatings.length > 0
        ? (validRatings.reduce((acc: number, r: any) => acc + r.generalStars, 0) / validRatings.length).toFixed(1)
        : "0.0";

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Performans Analizi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Genel Puan Kartı */}
                <View style={[styles.perfHeroCard, { borderColor: colors.primary }]}>
                    <View style={styles.perfHeroContent}>
                        <View>
                            <Text style={styles.perfHeroLabel}>GENEL PUAN ORTALAMASI</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={[styles.perfHeroScore, { color: colors.primary }]}>{avgScore}</Text>
                                <Text style={styles.perfHeroScoreMax}>/ 5.0</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <MaterialIcons key={i} name="star" size={22} color={i <= Math.round(parseFloat(avgScore)) ? "#fbbf24" : colors.surfaceBorder} />
                                ))}
                                <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 8, alignSelf: 'center' }}>{ratings.length} Yorum</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Yorum Listesi */}
                {ratings.length > 0 ? (
                    ratings.map((r: any) => (
                        <View key={r.id} style={styles.feedbackCard}>
                            <View style={styles.feedbackTop}>
                                <View style={styles.feedbackUser}>
                                    <View style={styles.feedbackAvatar}>
                                        <MaterialIcons name="person" size={20} color={colors.text} />
                                    </View>
                                    <View>
                                        <Text style={styles.feedbackName}>{r.userName}</Text>
                                        <Text style={styles.feedbackCompany}>{r.company || 'Bireysel'}</Text>
                                    </View>
                                </View>
                                <View style={styles.starsCont}>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <MaterialIcons key={i} name="star" size={16} color={i <= r.generalStars ? "#fbbf24" : colors.surfaceBorder} />
                                    ))}
                                </View>
                            </View>
                            {r.note ? <Text style={styles.feedbackNote}>"{r.note}"</Text> : null}
                            <Text style={styles.feedbackDate}>{r.date}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="rate-review" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Henüz yorum yok</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const StatCard = ({ icon, label, score, color, trend, styles }: any) => (
    <View style={styles.smallStatCard}>
        <View style={[styles.smallStatIconCont, { backgroundColor: `${color}15` }]}>
            <MaterialIcons name={icon} size={28} color={color} />
        </View>
        <Text style={styles.smallStatLabel}>{label}</Text>
        <View style={styles.smallStatBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.smallStatScore}>{score}</Text>
                <Text style={styles.smallStatScoreMax}> / 5</Text>
            </View>
            <Text style={[styles.smallStatTrend, { color: parseFloat(trend) >= 0 ? '#10b981' : '#ef4444' }]}>
                {trend ? (parseFloat(trend) >= 0 ? `+${trend}` : trend) : ""}
            </Text>
        </View>
    </View>
);

const FeedbackView = ({ onBack, ratings, colors, styles }: any) => {
    const insets = useSafeAreaInsets();
    const [feedbackTab, setFeedbackTab] = useState<"ORDER" | "APP">("ORDER");

    const filteredRatings = ratings.filter((r: any) => 
        feedbackTab === "ORDER" ? r.type !== 'app_feedback' : r.type === 'app_feedback'
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Müşteri Yorumları</Text>
            </View>

            <View style={{ flexDirection: "row", marginHorizontal: 24, marginBottom: 16, backgroundColor: colors.surfaceBorder, padding: 4, borderRadius: 12 }}>
                <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 }, feedbackTab === "ORDER" && { backgroundColor: colors.surface }]}
                    onPress={() => setFeedbackTab("ORDER")}
                >
                    <Text style={[{ fontSize: 13, fontWeight: "bold", color: colors.muted }, feedbackTab === "ORDER" && { color: colors.text }]}>SİPARİŞ YORUMLARI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 }, feedbackTab === "APP" && { backgroundColor: colors.surface }]}
                    onPress={() => setFeedbackTab("APP")}
                >
                    <Text style={[{ fontSize: 13, fontWeight: "bold", color: colors.muted }, feedbackTab === "APP" && { color: colors.text }]}>UYGULAMA GÖRÜŞLERİ</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {filteredRatings.length > 0 ? (
                    filteredRatings.map((r: any) => (
                        <View key={r.id} style={styles.feedbackCard}>
                            <View style={styles.feedbackTop}>
                                <View style={styles.feedbackUser}>
                                    <View style={styles.feedbackAvatar}>
                                        <MaterialIcons name="person" size={20} color={colors.text} />
                                    </View>
                                    <View>
                                        <Text style={styles.feedbackName}>{r.userName}</Text>
                                        <Text style={styles.feedbackCompany}>{r.company || 'Bireysel'}</Text>
                                    </View>
                                </View>
                                {r.type !== 'app_feedback' && (
                                    <View style={styles.starsCont}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <MaterialIcons key={i} name="star" size={16} color={i <= r.generalStars ? "#fbbf24" : colors.surfaceBorder} />
                                        ))}
                                    </View>
                                )}
                            </View>
                            {r.note ? <Text style={[styles.feedbackNote, r.type === 'app_feedback' && { fontStyle: 'normal', fontSize: 14, color: colors.text, marginTop: 8 }]}>"{r.note}"</Text> : null}
                            
                            {r.rating_details && ((Array.isArray(r.rating_details) && r.rating_details.length > 0) || (!Array.isArray(r.rating_details) && Object.keys(r.rating_details).length > 0)) && (
                                <View style={styles.ratingDetailsBox}>
                                    <Text style={styles.detailsTitle}>Yemek Puanları:</Text>
                                    {Array.isArray(r.rating_details) ? (
                                        r.rating_details.map((detail: any, idx: number) => (
                                            <View key={idx} style={[styles.detailsRow, { marginBottom: 4 }]}>
                                                <MaterialIcons name="restaurant" size={14} color={colors.primary} />
                                                <Text style={[styles.detailsText, { flex: 1 }]} numberOfLines={1}>
                                                    {detail.name}
                                                </Text>
                                                <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 2 }}>
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <MaterialIcons key={i} name="star" size={12} color={i <= detail.rating ? "#fbbf24" : colors.surfaceBorder} />
                                                    ))}
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.detailsRow}>
                                            <MaterialIcons name="restaurant" size={14} color={colors.primary} />
                                            <Text style={styles.detailsText}>
                                                {Object.keys(r.rating_details).length} kalem ürün değerlendirildi.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            <Text style={styles.feedbackDate}>{r.date}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="rate-review" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Henüz yorum yok</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    )
};

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder, marginRight: 16 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    sectionHeader: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginLeft: 24, marginBottom: 12, marginTop: 8 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
    menuContainer: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: "hidden" },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
    menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    menuItemIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceBorder, alignItems: "center", justifyContent: "center", marginRight: 16 },
    menuItemLabel: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 4 },
    menuItemSubtitle: { fontSize: 12, color: colors.muted },

    // Sales View
    exportPdfButton: { flexDirection: "row", alignItems: "center", backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
    exportPdfText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
    filterTabsContainer: { flexDirection: "row", marginHorizontal: 24, marginBottom: 20, backgroundColor: colors.surfaceBorder, padding: 4, borderRadius: 8 },
    filterTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 6 },
    filterTabActive: { backgroundColor: colors.surface },
    filterTabText: { fontSize: 12, fontWeight: "bold", color: colors.muted },
    filterTabTextActive: { color: colors.text },
    statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: 'wrap' },
    statBox: { flex: 1, padding: 20, borderRadius: 24, borderWidth: 1 },
    statBoxLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
    statBoxValue: { fontSize: 24, fontWeight: "900", color: colors.text },
    orderCard: { backgroundColor: colors.surface, padding: 20, borderRadius: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 12 },
    orderName: { fontSize: 14, fontWeight: "bold", color: colors.text, marginBottom: 4 },
    orderIdLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
    orderTotal: { fontSize: 16, fontWeight: "900", color: colors.text },
    orderTime: { fontSize: 10, fontWeight: "bold", color: colors.muted, textTransform: "uppercase", marginTop: 4 },
    emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60 },
    emptyText: { marginTop: 16, fontSize: 12, fontWeight: "900", color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },

    // Perf View
    perfHeroCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1 },
    perfHeroContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    perfHeroLabel: { color: colors.muted, fontSize: 12, fontWeight: "bold", marginBottom: 8 },
    perfHeroScore: { fontSize: 48, fontWeight: "bold" },
    perfHeroScoreMax: { color: colors.muted, fontSize: 16, fontWeight: "bold", marginLeft: 8 },
    perfHeroDesc: { fontSize: 12, marginTop: 8 },

    smallStatCard: { width: "47%", backgroundColor: colors.surface, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.surfaceBorder, marginBottom: 16 },
    smallStatIconCont: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    smallStatLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
    smallStatBottom: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    smallStatScore: { fontSize: 24, fontWeight: "900", color: colors.text },
    smallStatScoreMax: { fontSize: 12, fontWeight: "900", color: colors.muted },
    smallStatTrend: { fontSize: 10, fontWeight: "900" },

    // Feedback View
    feedbackCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, marginBottom: 16 },
    feedbackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    feedbackUser: { flexDirection: "row", alignItems: "center", gap: 12 },
    feedbackAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceBorder, alignItems: "center", justifyContent: "center" },
    feedbackName: { fontSize: 14, fontWeight: "bold", color: colors.text, marginBottom: 2 },
    feedbackCompany: { fontSize: 12, color: colors.muted },
    starsCont: { flexDirection: "row", gap: 2 },
    feedbackNote: { fontSize: 14, color: colors.text, fontStyle: "italic", lineHeight: 22, marginBottom: 16 },
    ratingDetailsBox: {
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder
    },
    detailsTitle: { fontSize: 11, fontWeight: 'bold', color: colors.muted, marginBottom: 4 },
    detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailsText: { fontSize: 12, color: colors.text },
    feedbackDate: { fontSize: 10, fontWeight: "900", color: colors.muted, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }
});
