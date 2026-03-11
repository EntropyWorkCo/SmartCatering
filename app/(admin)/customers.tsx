import ThemeSwitcher from "@/components/ThemeSwitcher"; // tema değiştirme butonu
import Colors from "@/constants/Colors"; // renkler
import { useResolvedTheme } from "@/lib/store/themeStore"; // aktif temayı döndürür. (light-dark)
import { supabase } from "@/lib/supabase"; // supabase client. auth,database,storage işlemleri yapılır
import { MaterialIcons } from "@expo/vector-icons"; // google material ikonları
import { router, useFocusEffect } from "expo-router"; // expo router navigation system,geri gitmek için kullanılır. useFocusEffect sayfa açıldığında veya tekrar odaklandığıında çalışır.
import React, { useState } from "react"; // react
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; //Telefonun notch / status bar alanına çarpmamak için kullanılır

// TODO: Replace with actual backend integration (e.g. useAdmin hook fetching users from Supabase profiles table)
// For now, providing a mock matching the web code's structure
//bir User interface tanımlanmış. Her müşteri için şu bilgiler tutuluyor
interface User {
    id: string;
    name: string;
    phone: string;
    company?: string;
    vkn?: string | null;
    balance?: number;
}

export default function AdminCustomers() {
    const [customers, setCustomers] = useState<User[]>([]); //müşterileri tutar
    const [searchTerm, setSearchTerm] = useState(""); //arama terimi
    const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL"); //ana sekmeleri tutar
    const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({}); //şirketlerin açılıp kapandığı accordion durumu

    const insets = useSafeAreaInsets();
    const theme = useResolvedTheme(); //aktif temayı döndürür. (light-dark)
    const colors = Colors[theme]; //renkleri döndürür
    const styles = getStyles(colors); //stilleri döndürür

    useFocusEffect( //sayfa açıldığında veya tekrar odaklandığıında çalışır.    üç farklı tablodan veri çeker:users,adisyon,companies
        React.useCallback(() => {
            const fetchCustomers = async () => {
                try {
                    // Fetch users
                    const { data: usersData, error: usersError } = await supabase.from('users').select('*');
                    if (usersError) {
                        console.error("Müşteriler yüklenirken hata:", usersError);
                        return;
                    }

                    // Fetch adisyon (orders) to calculate balance
                    const { data: ordersData, error: ordersError } = await supabase.from('adisyon').select('*');
                    if (ordersError) {
                        console.error("Adisyonlar yüklenirken hata:", ordersError);
                    }

                    // Fetch companies to map corporate users
                    const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*');
                    if (companiesError) {
                        console.error("Şirketler yüklenirken hata:", companiesError);
                    }

                    if (usersData) {
                        const formattedUsers: User[] = usersData.map((profile: any) => {
                            // Find company if exists
                            const userCompany = companiesData?.find((c: any) => c.user_id === profile.id);

                            // Calculate balance
                            let balance = 0;
                            if (ordersData) {
                                const userOrders = ordersData.filter((o: any) => 
                                    o.user_id === profile.id && !["CANCELLED", "İptal", "PAID", "Ödendi", "COMPLETED", "Tamamlandı"].includes(o.status)
                                );
                                balance = userOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
                            }

                            return {
                                id: profile.id,             
                                name: profile.full_name || 'İsimsiz Müşteri',
                                phone: profile.phone || 'Telefon Yok',
                                company: userCompany ? userCompany.company_name : (profile.company_name || 'Bireysel Üyelik'),
                                vkn: userCompany ? userCompany.tax_number : null,
                                balance: balance
                            };
                        });
                        setCustomers(formattedUsers);
                    }
                } catch (err) {
                    console.error("Veri çekme hatası:", err);
                }
            };

            fetchCustomers();
        }, [])
    );

    const filteredCustomers = customers.filter(
        (c) =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm) ||
            (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const bireyselCustomers = filteredCustomers.filter(c => !c.company || c.company === 'Bireysel Üyelik');
    const kurumsalCustomers = filteredCustomers.filter(c => c.company && c.company !== 'Bireysel Üyelik');

    const groupedKurumsal = React.useMemo(() => {
        const groups: Record<string, { companyName: string; vkn: string; totalDebt: number; customers: User[] }> = {};
        for (const c of kurumsalCustomers) {
            const key = c.vkn || c.company || 'Unknown';
            if (!groups[key]) {
                groups[key] = { companyName: c.company || 'İsimsiz Firma', vkn: c.vkn || '', totalDebt: 0, customers: [] };
            }
            groups[key].customers.push(c);
            groups[key].totalDebt += (c.balance || 0);
        }
        return Object.values(groups).sort((a, b) => b.totalDebt - a.totalDebt);
    }, [kurumsalCustomers]);

    const toggleCompany = (vkn: string) => {
        setExpandedCompanies(prev => ({
            ...prev,
            [vkn]: !prev[vkn]
        }));
    };

    const renderCustomerCard = (customer: User, isNested: boolean = false) => (
        <View key={customer.id} style={[styles.customerCard, isNested && styles.nestedCustomerCard]}>
            <View style={styles.cardContent}>
                <View style={[styles.avatar, isNested && styles.nestedAvatar]}>
                    <Text style={{ fontSize: isNested ? 16 : 20, fontWeight: 'bold', color: colors.muted }}>
                        {customer.name.charAt(0)}
                    </Text>
                </View>

                <View style={styles.customerInfo}>
                    <Text style={styles.customerName} numberOfLines={1}>
                        {customer.name}
                    </Text>
                    <Text style={styles.customerPhone}>{customer.phone}</Text>
                    {customer.company && customer.company !== "Bireysel Üyelik" && !isNested && (
                        <View style={styles.companyTag}>
                            <MaterialIcons name="verified" size={12} color={colors.primary} />
                            <Text style={styles.companyText}>{customer.company}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.balanceContainer}>
                    <Text style={[styles.balanceAmount, { color: (customer.balance || 0) > 0 ? colors.text : colors.muted }]}>
                        ₺{customer.balance?.toLocaleString("tr-TR") || 0}
                    </Text>
                    <Text style={styles.balanceLabel}>BORÇ</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Müşteri Listesi</Text>
                    <Text style={styles.subtitle}>Kayıtlı Tüm Kullanıcılar</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, mainTab === "KURUMSAL" && styles.activeTab]}
                    onPress={() => setMainTab("KURUMSAL")}
                >
                    <Text style={[styles.tabText, mainTab === "KURUMSAL" && styles.activeTabText]}>
                        KURUMSAL FİRMALAR
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, mainTab === "BIREYSEL" && styles.activeTab]}
                    onPress={() => setMainTab("BIREYSEL")}
                >
                    <Text style={[styles.tabText, mainTab === "BIREYSEL" && styles.activeTabText]}>
                        BİREYSEL HESAPLAR
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={24} color={colors.muted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="İsim, telefon veya firma ara..."
                    placeholderTextColor={colors.muted}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {mainTab === "BIREYSEL" && (
                    bireyselCustomers.length > 0 ? (
                        bireyselCustomers.map(customer => renderCustomerCard(customer, false))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="person-off" size={64} color={colors.surfaceBorder} />
                            <Text style={styles.emptyText}>Bireysel müşteri bulunamadı.</Text>
                        </View>
                    )
                )}

                {mainTab === "KURUMSAL" && (
                    groupedKurumsal.length > 0 ? (
                        groupedKurumsal.map(group => {
                            const isExpanded = expandedCompanies[group.vkn];
                            return (
                                <View key={group.vkn} style={styles.companyAccordion}>
                                    <TouchableOpacity
                                        style={styles.companyAccordionHeader}
                                        onPress={() => toggleCompany(group.vkn)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.accordionTitleContainer}>
                                            <Text style={styles.companyAccordionTitle}>{group.companyName}</Text>
                                            <Text style={styles.companyAccordionSubtitle}>{group.customers.length} Kayıtlı Çalışan</Text>
                                        </View>
                                        <View style={styles.accordionRightContainer}>
                                            <View style={styles.balanceContainer}>
                                                <Text style={[styles.balanceAmount, { color: group.totalDebt > 0 ? colors.text : colors.muted }]}>
                                                    ₺{group.totalDebt.toLocaleString("tr-TR")}
                                                </Text>
                                                <Text style={styles.balanceLabel}>TOPLAM BORÇ</Text>
                                            </View>
                                            <MaterialIcons
                                                name={isExpanded ? "expand-less" : "expand-more"}
                                                size={24}
                                                color={colors.text}
                                                style={{ marginLeft: 12 }}
                                            />
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.companyAccordionContent}>
                                            {group.customers.map(customer => renderCustomerCard(customer, true))}
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="domain-disabled" size={64} color={colors.surfaceBorder} />
                            <Text style={styles.emptyText}>Kurumsal firma bulunamadı.</Text>
                        </View>
                    )
                )}
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        marginRight: 16,
    },
    headerText: { flex: 1 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    subtitle: {
        fontSize: 10,
        fontWeight: "bold",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: "row",
        paddingHorizontal: 24,
        marginBottom: 20,
        gap: 12,
    },
    tab: {
        flex: 1,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.muted,
    },
    activeTabText: {
        color: colors.primary,
    },
    searchContainer: {
        marginHorizontal: 24,
        marginBottom: 24,
        position: "relative",
        justifyContent: "center",
    },
    searchIcon: {
        position: "absolute",
        left: 16,
        zIndex: 1,
    },
    searchInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 16,
        paddingVertical: 16,
        paddingLeft: 48,
        paddingRight: 16,
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    companyAccordion: {
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    companyAccordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: colors.surface,
    },
    accordionTitleContainer: {
        flex: 1,
        paddingRight: 16,
    },
    companyAccordionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    companyAccordionSubtitle: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: 'bold',
        marginTop: 4,
    },
    accordionRightContainer: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    companyAccordionContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: colors.background,
    },
    customerCard: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
    },
    nestedCustomerCard: {
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
        paddingVertical: 12,
    },
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    nestedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    customerInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 4,
    },
    customerPhone: {
        fontSize: 12,
        color: colors.muted,
        marginBottom: 4,
    },
    companyTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    companyText: {
        fontSize: 10,
        fontWeight: "bold",
        color: colors.primary,
    },
    balanceContainer: {
        alignItems: "flex-end",
    },
    balanceLabel: {
        fontSize: 10,
        color: colors.muted,
        marginTop: 4,
        fontWeight: 'bold',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: "bold",
        color: colors.muted,
    },
});
