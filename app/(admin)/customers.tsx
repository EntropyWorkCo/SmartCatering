import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// TODO: Replace with actual backend integration (e.g. useAdmin hook fetching users from Supabase profiles table)
// For now, providing a mock matching the web code's structure
interface User {
    id: string;
    name: string;
    phone: string;
    company?: string;
    balance?: number;
}

export default function AdminCustomers() {
    const [customers, setCustomers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const insets = useSafeAreaInsets();

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    useFocusEffect(
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

                    if (usersData) {
                        const formattedUsers: User[] = usersData.map((profile: any) => {
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
                                company: profile.company_name || 'Bireysel Üyelik',
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Müşteri Listesi</Text>
                    <Text style={styles.subtitle}>Kayıtlı Tüm Kullanıcılar</Text>
                </View>
                <ThemeSwitcher />
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
                {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                        <View key={customer.id} style={styles.customerCard}>
                            <View style={styles.cardContent}>
                                <View
                                    style={[
                                        styles.avatar,
                                        customer.company && customer.company !== "Bireysel Üyelik"
                                            ? { backgroundColor: colors.cardHighlight }
                                            : { backgroundColor: colors.infoBg },
                                    ]}
                                >
                                    <MaterialIcons
                                        name={
                                            customer.company && customer.company !== "Bireysel Üyelik"
                                                ? "business"
                                                : "person"
                                        }
                                        size={28}
                                        color={
                                            customer.company && customer.company !== "Bireysel Üyelik"
                                                ? colors.primary
                                                : colors.info
                                        }
                                    />
                                </View>

                                <View style={styles.customerInfo}>
                                    <Text style={styles.customerName} numberOfLines={1}>
                                        {customer.name}
                                    </Text>
                                    <Text style={styles.customerPhone}>{customer.phone}</Text>
                                    {customer.company && customer.company !== "Bireysel Üyelik" && (
                                        <View style={styles.companyTag}>
                                            <MaterialIcons name="verified" size={12} color={colors.primary} />
                                            <Text style={styles.companyText}>{customer.company}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.balanceContainer}>
                                    <Text style={styles.balanceLabel}>BAKİYE</Text>
                                    <Text style={styles.balanceAmount}>
                                        ₺{customer.balance?.toLocaleString("tr-TR") || 0}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="person-off" size={64} color={colors.surfaceBorder} />
                        <Text style={styles.emptyText}>Müşteri bulunamadı.</Text>
                    </View>
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
    customerCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    customerInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: "900",
        color: colors.text,
        marginBottom: 4,
    },
    customerPhone: {
        fontSize: 12,
        fontWeight: "bold",
        color: colors.muted,
        marginBottom: 6,
    },
    companyTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    companyText: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.primary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    balanceContainer: {
        backgroundColor: colors.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: "flex-end",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    balanceLabel: {
        fontSize: 9,
        fontWeight: "900",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 2,
    },
    balanceAmount: {
        fontSize: 14,
        fontWeight: "900",
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
