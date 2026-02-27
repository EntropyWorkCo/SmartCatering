import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                // Fetch users
                const { data, error } = await supabase.from('users').select('*');
                if (error) {
                    console.error("Müşteriler yüklenirken hata:", error);
                    return;
                }

                if (data) {
                    const formattedUsers: User[] = data.map((profile: any) => ({
                        id: profile.id,
                        name: profile.full_name || 'İsimsiz Müşteri',
                        phone: profile.phone || 'Telefon Yok',
                        company: profile.company_name || 'Bireysel Üyelik',
                        balance: 0 // Mock balance until adisyon is fully synced to users
                    }));
                    setCustomers(formattedUsers);
                }
            } catch (err) {
                console.error("Veri çekme hatası:", err);
            }
        };

        fetchCustomers();
    }, []);

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
                    <MaterialIcons name="arrow-back" size={24} color="#64748b" />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Müşteri Listesi</Text>
                    <Text style={styles.subtitle}>Kayıtlı Tüm Kullanıcılar</Text>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={24} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="İsim, telefon veya firma ara..."
                    placeholderTextColor="#94a3b8"
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
                                            ? { backgroundColor: "rgba(116, 207, 98, 0.1)" }
                                            : { backgroundColor: "rgba(59, 130, 246, 0.1)" },
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
                                                ? "#74CF62"
                                                : "#3b82f6"
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
                                            <MaterialIcons name="verified" size={12} color="#74CF62" />
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
                        <MaterialIcons name="person-off" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyText}>Müşteri bulunamadı.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
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
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginRight: 16,
    },
    headerText: { flex: 1 },
    title: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
    subtitle: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#64748b",
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
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 16,
        paddingVertical: 16,
        paddingLeft: 48,
        paddingRight: 16,
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f172a",
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    customerCard: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#f1f5f9",
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
        color: "#0f172a",
        marginBottom: 4,
    },
    customerPhone: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#64748b",
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
        color: "#74CF62",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    balanceContainer: {
        backgroundColor: "#f8fafc",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: "flex-end",
        borderWidth: 1,
        borderColor: "#f1f5f9",
    },
    balanceLabel: {
        fontSize: 9,
        fontWeight: "900",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 2,
    },
    balanceAmount: {
        fontSize: 14,
        fontWeight: "900",
        color: "#0f172a",
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
        color: "#94a3b8",
    },
});
