import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAdisyon } from "@/lib/hooks/useAdisyon";
import { useResolvedTheme } from "@/lib/store/themeStore";
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

    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    // Mock veri üzerinden gidelim
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
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.preTitle}>MEYDAN LOKANTA</Text>
                    <Text style={styles.title}>Gelen Mesajlar</Text>
                    <Text style={styles.subtitle}>Sipariş notları ve müşteri talepleri</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {ordersWithNotes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <MaterialIcons name="chat-bubble-outline" size={48} color={colors.surfaceBorder} />
                        </View>
                        <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                    </View>
                ) : (
                    ordersWithNotes.map((order) => (
                        <View key={order.id} style={styles.messageCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.userInfo}>
                                    <View style={styles.avatar}>
                                        <MaterialIcons name="person" size={20} color={colors.primary} />
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
                                    <MaterialIcons name="done-all" size={16} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
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
        alignItems: "flex-start",
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 16,
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
        marginTop: 4,
    },
    headerText: { flex: 1 },
    preTitle: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.primary,
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: { fontSize: 28, fontWeight: "900", color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 12, color: colors.muted, fontWeight: "bold" },
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
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: "bold",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 1.5,
    },
    messageCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
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
        backgroundColor: colors.cardHighlight,
        alignItems: "center",
        justifyContent: "center",
    },
    userName: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 2,
    },
    orderLabel: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.muted,
        textTransform: "uppercase",
    },
    messageBox: {
        backgroundColor: colors.background,
        padding: 16,
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    messageText: {
        fontSize: 14,
        color: colors.text,
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
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "bold",
        color: colors.muted,
    },
    markReadBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    markReadText: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.primary,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
});
