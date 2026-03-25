import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function SupportScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        if (!user) return;
        
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching messages:", error);
        } else {
            setMessages(data || []);
        }
        setLoading(false);
    };

    const markAsRead = async () => {
        if (!user) return;
        
        await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("user_id", user.id)
            .eq("is_from_admin", true)
            .eq("is_read", false);
    };

    useEffect(() => {
        markAsRead();
    }, [messages.length]);

    useEffect(() => {
        fetchMessages();

        const channel = supabase
            .channel(`user-chat-${user?.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'messages',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    useFocusEffect(
        React.useCallback(() => {
            markAsRead();
        }, [user?.id])
    );

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert("Eksik Mesaj", "Lütfen bir mesaj yazınız.");
            return;
        }

        setSubmitting(true);
        try {
            if (user) {
                const { error } = await supabase.from("messages").insert({
                    user_id: user.id,
                    content: message.trim(),
                    is_read: false,
                    is_from_admin: false
                });

                if (error) throw error;
                setMessage("");
                fetchMessages();
            }
        } catch (error: any) {
            Alert.alert("Hata", error.message || "Mesajınız gönderilemedi.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isFromMe = !item.is_from_admin;
        return (
            <View style={[styles.messageRow, isFromMe ? styles.myMessageRow : styles.adminMessageRow]}>
                <View style={[styles.messageBubble, isFromMe ? styles.myBubble : styles.adminBubble]}>
                    <Text style={[styles.messageText, isFromMe ? styles.myText : styles.adminText]}>
                        {item.content}
                    </Text>
                    <Text style={[styles.messageTime, isFromMe ? styles.myTime : styles.adminTime]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Destek & Öneri</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Mutfak Yönetimiyle İletişim</Text>
                </View>
            </View>

            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.chatList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <View style={styles.iconCircle}>
                                    <MaterialIcons name="support-agent" size={48} color={colors.primary} />
                                </View>
                                <Text style={styles.emptyTitle}>Nasıl Yardımcı Olabiliriz?</Text>
                                <Text style={styles.emptySub}>Mutfak yönetimine her türlü istek, öneri veya şikayetinizi buradan iletebilirsiniz.</Text>
                            </View>
                        }
                    />
                )}

                <View style={styles.inputArea}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Mesajınızı yazın..."
                            placeholderTextColor={colors.muted}
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity 
                            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]} 
                            onPress={handleSubmit}
                            disabled={!message.trim() || submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <MaterialIcons name="send" size={24} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderColor: colors.surfaceBorder,
        backgroundColor: colors.background
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 20, fontWeight: '900', color: colors.text },
    
    chatList: { padding: 20, paddingBottom: 40 },
    messageRow: { marginBottom: 16, flexDirection: 'row', width: '100%' },
    myMessageRow: { justifyContent: 'flex-end' },
    adminMessageRow: { justifyContent: 'flex-start' },
    
    messageBubble: {
        maxWidth: '80%', padding: 12, borderRadius: 20,
        position: 'relative',
    },
    myBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    adminBubble: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1, borderColor: colors.surfaceBorder
    },
    
    messageText: { fontSize: 15, lineHeight: 20 },
    myText: { color: '#fff' },
    adminText: { color: colors.text },
    
    messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    myTime: { color: 'rgba(255,255,255,0.7)' },
    adminTime: { color: colors.muted },
    
    inputArea: {
        padding: 16, 
        paddingBottom: Platform.OS === 'ios' ? 16 : 24,
        backgroundColor: colors.background,
        borderTopWidth: 1, borderColor: colors.surfaceBorder
    },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 24,
        paddingLeft: 20, paddingRight: 8, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.surfaceBorder
    },
    input: { flex: 1, fontSize: 15, color: colors.text, maxHeight: 100 },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center'
    },
    sendBtnDisabled: { backgroundColor: colors.muted, opacity: 0.5 },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primary + '15',
        alignItems: 'center', justifyContent: 'center', marginBottom: 24
    },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }
});
