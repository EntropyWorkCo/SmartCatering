import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminMessages() {
    const { orders } = useAdisyon();
    const insets = useSafeAreaInsets();

    // Şimdilik not içeren siparişleri bulalım veya mock yaratılım
    // (Uygulamada orders modelinizde note veya notes alanı var mı diye bakılabilir)
    // Mock veri üzerinden gidelim, çünkü mevcut orders.ts yapısında 'note' alanı garanti değil
    const ordersWithNotes = [
        {
            id: "1",
            userName: "Sena Arslan",
            orderNumber: "10025",
            date: "2023-10-25 12:30",
            note: "Lütfen yemekler sıcak gelsin, çatal bıçak eklemeyi unutmayın.",
            itemsCount: 5
        },
        {
            id: "2",
            userName: "Tech A.Ş.",
            orderNumber: "10026",
            date: "2023-10-25 13:15",
            note: "Kurumsal fatura kesilecek, ilgili birime iletildi.",
            itemsCount: 15
        }
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#64748b" />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.preTitle}>MEYDAN LOKANTA</Text>
                    <Text style={styles.title}>Gelen Mesajlar</Text>
                    <Text style={styles.subtitle}>Sipariş notları ve müşteri talepleri</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {ordersWithNotes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <MaterialIcons name="chat-bubble-outline" size={48} color="#cbd5e1" />
                        </View>
                        <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                    </View>
                ) : (
                    ordersWithNotes.map((order) => (
                        <View key={order.id} style={styles.messageCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.userInfo}>
                                    <View style={styles.avatar}>
                                        <MaterialIcons name="person" size={20} color="#74CF62" />
                                    </View>
                                    <View>
                                        <Text style={styles.userName}>{order.userName || "Müşteri"}</Text>
                                        <Text style={styles.orderLabel}>Sipariş #{order.orderNumber}</Text>
                                    </View>
                                </View>
                                <Text style={styles.timeText}>{order.date.split(" ")[1]}</Text>
                            </View>

                            <View style={styles.messageBox}>
                                <Text style={styles.messageText}>"{order.note}"</Text>
                            </View>

                            <View style={styles.cardFooter}>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{order.itemsCount} Porsiyon</Text>
                                </View>
                                <TouchableOpacity style={styles.markReadBtn}>
                                    <Text style={styles.markReadText}>OKUNDU İŞARETLE</Text>
                                    <MaterialIcons name="done-all" size={16} color="#74CF62" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
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
        alignItems: "flex-start",
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 16,
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
        marginTop: 4,
    },
    headerText: { flex: 1 },
    preTitle: {
        fontSize: 10,
        fontWeight: "900",
        color: "#74CF62",
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: { fontSize: 28, fontWeight: "900", color: "#0f172a", marginBottom: 4 },
    subtitle: { fontSize: 12, color: "#64748b", fontWeight: "bold" },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#f1f5f9",
    },
    emptyText: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 1.5,
    },
    messageCard: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#f1f5f9",
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(116, 207, 98, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    userName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f172a",
        marginBottom: 2,
    },
    orderLabel: {
        fontSize: 10,
        fontWeight: "900",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: 10,
        fontWeight: "900",
        color: "#cbd5e1",
        textTransform: "uppercase",
    },
    messageBox: {
        backgroundColor: "#f8fafc",
        padding: 16,
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: "#74CF62",
    },
    messageText: {
        fontSize: 14,
        color: "#334155",
        fontWeight: "500",
        fontStyle: "italic",
        lineHeight: 22,
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 16,
    },
    badge: {
        backgroundColor: "#f1f5f9",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#64748b",
    },
    markReadBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    markReadText: {
        fontSize: 10,
        fontWeight: "900",
        color: "#74CF62",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
});
