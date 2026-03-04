import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
    const [submitting, setSubmitting] = useState(false);

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
                    is_read: false
                });

                if (error) throw error;
            }

            Alert.alert("Mesaj Gönderildi", "Talebiniz yönetime başarıyla iletildi.", [
                { text: "Tamam", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert("Hata", error.message || "Mesajınız gönderilemedi.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Bize Ulaşın</Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.topSection}>
                        <View style={styles.iconCircle}>
                            <MaterialIcons name="support-agent" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.questionText}>Size Nasıl Yardımcı Olabiliriz?</Text>
                        <Text style={styles.subQuestionText}>Taleplerinizi veya özel sipariş notlarınızı doğrudan mutfak yönetimine iletebilirsiniz.</Text>
                    </View>

                    <View style={styles.feedbackSection}>
                        <Text style={styles.sectionTitle}>Mesajınız</Text>
                        <View style={styles.textAreaContainer}>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Örn: Yemeklerimde alerjen uyarısına dikkat edebilir misiniz?"
                                placeholderTextColor={colors.muted}
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.submitBtn, !message.trim() && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!message.trim() || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitBtnText}>Mesajı Gönder</Text>
                        )}
                    </TouchableOpacity>
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
        borderBottomWidth: 1, borderColor: colors.surfaceBorder
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },

    scrollContent: { paddingBottom: 40 },

    topSection: { padding: 32, alignItems: 'center', borderBottomWidth: 1, borderColor: colors.surfaceBorder },
    iconCircle: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.cardHighlight, borderWidth: 1, borderColor: colors.primary,
        alignItems: 'center', justifyContent: 'center', marginBottom: 24
    },
    questionText: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 8 },
    subQuestionText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: 16 },

    feedbackSection: { padding: 24, gap: 8 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 4 },

    textAreaContainer: {
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        padding: 16, minHeight: 150
    },
    textArea: { flex: 1, fontSize: 15, color: colors.text },

    footer: { padding: 24, paddingBottom: 32, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.surfaceBorder },
    submitBtn: {
        backgroundColor: colors.primary,
        height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    submitBtnDisabled: { backgroundColor: colors.surfaceBorder, shadowOpacity: 0, elevation: 0 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
