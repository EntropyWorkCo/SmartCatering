import { MaterialIcons } from "@expo/vector-icons";
import * as Sharing from 'expo-sharing';
import React, { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from 'react-native-webview';

import Colors from "@/constants/Colors";
import { useResolvedTheme } from "@/lib/store/themeStore";

interface EkstreOnizlemeModalProps {
    visible: boolean;
    onClose: () => void;
    pdfUri: string | null;
    htmlContent: string;
    firmaAdi: string;
    donemBilgisi: string;
}

export default function EkstreOnizlemeModal({ visible, onClose, pdfUri, htmlContent, firmaAdi, donemBilgisi }: EkstreOnizlemeModalProps) {
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const [loading, setLoading] = useState(false);

    const handleShare = async () => {
        if (!pdfUri) return;
        try {
            await Sharing.shareAsync(pdfUri);
        } catch (error) {
            console.error("Paylaşım hatası:", error);
        }
    };

    const handleDownload = async () => {
        // Expo-print ile oluşturulan dosya zaten cihazda geçici bir URI'da 
        // Bu yüzden "İndir" butonu aslında "Paylaş/Kaydet" diyaloğunu açar veya 
        // Kullanıcıya dosyanın hazır olduğunu bildirir.
        if (!pdfUri) return;
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            // Gerçek bir indirme (Gallery/Downloads) işlemi için ek kütüphaneler gerekebilir, 
            // ancak expo-sharing ile "Save to Files" seçeneği sunulur.
            handleShare();
        }, 1000);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.surfaceBorder }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{firmaAdi}</Text>
                        <Text style={[styles.modalSub, { color: colors.muted }]}>{donemBilgisi}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.webViewContainer}>
                    {htmlContent ? (
                        <WebView 
                            originWhitelist={['*']}
                            source={{ html: htmlContent }}
                            style={{ flex: 1, backgroundColor: 'transparent' }}
                        />
                    ) : (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ marginTop: 10, color: colors.muted }}>Ekstre hazırlanıyor...</Text>
                        </View>
                    )}
                </View>

                {/* Footer Buttons */}
                <View style={[styles.footer, { borderTopColor: colors.surfaceBorder }]}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder }]} 
                        onPress={onClose}
                    >
                        <MaterialIcons name="arrow-back" size={20} color={colors.text} style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: colors.text }]}>Kapat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]} 
                        onPress={handleDownload}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <MaterialIcons name="file-download" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>İndir</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: "#1a2e4a" }]} 
                        onPress={handleShare}
                    >
                        <MaterialIcons name="share" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Paylaş</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalSub: { fontSize: 12 },
    closeBtn: { padding: 8 },
    webViewContainer: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    footer: {
        flexDirection: 'row',
        padding: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        gap: 10
    },
    actionBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: { fontWeight: 'bold', fontSize: 14, color: '#fff' }
});
