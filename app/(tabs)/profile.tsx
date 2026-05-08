import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import Colors from "@/constants/Colors";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { billingService } from "@/lib/services/billingService";
import { feedbackService } from "@/lib/services/feedbackService";
import { userService } from "@/lib/services/userService";
import { useResolvedTheme } from "@/lib/store/themeStore";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useResolvedTheme();
    const colors = Colors[theme];
    const styles = getStyles(colors);

    const { user } = useAuth();
    const { profile, loading, refresh } = useProfile(user?.id);
    const actualCompanyId = profile?.corporate_info?.id || profile?.company_id;
    const isCompanyOwner = profile?.role === 'owner' || profile?.role === 'corporate';

    // Sekme her odaklandığında veriyi yenile (Örn: Kurumsal Bilgiler'den dönünce)
    useFocusEffect(
        React.useCallback(() => {
            refresh();
        }, [user?.id])
    );

    const [fullName, setFullName] = useState("");
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);

    // Feedback Modal State
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackSending, setFeedbackSending] = useState(false);

    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refresh();
        } finally {
            setRefreshing(false);
        }
    }, [refresh]);

    // Initialize state once profile is loaded
    React.useEffect(() => {
        const init = async () => {
            if (profile) {
                setFullName(profile.full_name || "");
            }

            // Profil fotoğrafını önce yerel bellekten, yoksa veritabanından al
            const storedPhoto = await AsyncStorage.getItem(`profile_photo_${user?.id}`);
            if (storedPhoto) {
                setPhotoUrl(storedPhoto);
            } else if (profile?.avatar_url) {
                setPhotoUrl(profile.avatar_url);
            }

            const storedVal = await AsyncStorage.getItem("notifications_enabled");
            if (storedVal !== null) {
                setNotificationsEnabled(storedVal === "true");
            }

            // Borç bakiyesini çek
            if (user?.id) {
                try {
                    const debt = await billingService.getUserBalance(user.id);
                    setBalance(debt);
                } catch (err) {
                    console.log("Bakiye çekilemedi:", err);
                }
            }
        };
        init();
    }, [profile, user]);

    const handleToggleNotifications = async (val: boolean) => {
        setNotificationsEnabled(val);
        await AsyncStorage.setItem("notifications_enabled", val.toString());
    };

    const handlePickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            setPhotoUrl(uri);
            if (user?.id) {
                await AsyncStorage.setItem(`profile_photo_${user.id}`, uri);
            }
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;
        
        if (!fullName.trim()) {
            Alert.alert("Hata", "Lütfen ad soyad giriniz.");
            return;
        }

        setSaving(true);
        try {
            await userService.updateProfile(user.id, {
                fullName,
                phone: profile?.phone || ""
            });
            Alert.alert("Başarılı", "Profiliniz güncellendi.");
            await refresh(); // Veriyi tazeleyelim
        } catch (error: any) {
            console.error("Profil güncelleme hatası:", error);
            Alert.alert("Hata", "Profil güncellenirken bir hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem("softUser");
        await AsyncStorage.removeItem("isAdmin");
        const { error } = await supabase.auth.signOut();
        router.replace("/welcome");
    };

    const handleSendFeedback = async () => {
        if (!feedbackText.trim()) {
            Alert.alert("Boş Mesaj", "Lütfen görüşünüzü yazınız.");
            return;
        }
        if (!user?.id) return;

        setFeedbackSending(true);
        try {
            await feedbackService.submitAppFeedback(user.id, feedbackText.trim());
            setFeedbackText("");
            setFeedbackModalVisible(false);
            Alert.alert("Teşekkürler! 🙏", "Görüşünüz başarıyla iletildi. Daha iyi bir deneyim için değerlendirmeniz bizim için çok değerli.");
        } catch (error: any) {
            console.error("Görüş gönderme hatası:", error);
            Alert.alert("Hata", "Görüş gönderilemedi, lütfen tekrar deneyin.");
        } finally {
            setFeedbackSending(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Hesabım</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                        [{isCompanyOwner ? "Firma Sahibi Yetkisi Aktif" : (profile?.company_id || profile?.is_company ? "Kurumsal Çalışan Modu Aktif" : "Bireysel Mod / Yetki Yok")}]
                    </Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} title="Yenileniyor..." titleColor={colors.text} colors={[colors.primary]} progressBackgroundColor="#ffffff" progressViewOffset={30} />}
            >
                {/* Profile Image Section */}
                <View style={styles.imageSection}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.imageContainer}>
                        <Image
                            source={{ uri: photoUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${fullName || 'Misafir'}` }}
                            style={styles.profileImage}
                        />
                        <View style={styles.imageOverlay}>
                            <MaterialIcons name="camera-alt" size={24} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* User Info Form */}
                <View style={styles.formSection}>

                    <View style={styles.roleBadgeContainer}>
                        <View style={styles.roleBadge}>
                            <MaterialIcons
                                name={profile?.is_company ? 'business' : 'person'}
                                size={20}
                                color={colors.primary}
                            />
                            <Text style={styles.roleText}>
                                {profile?.is_company ? 'Kurumsal Üye' : 'Bireysel Üye'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.label}>Ad Soyad</Text>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="person" size={20} color={colors.muted} />
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Ad Soyad"
                            placeholderTextColor={colors.muted}
                        />
                    </View>



                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Profili Güncelle</Text>
                        )}
                    </TouchableOpacity>

                    {(balance !== null && balance > 0 && !profile?.is_company) && (
                        <View style={[styles.debtCard, { backgroundColor: colors.primary + '15' }]}>
                            <View>
                                <Text style={[styles.debtLabel, { color: colors.muted }]}>GÜNCEL TOPLAM BORÇ</Text>
                                <Text style={[styles.debtAmount, { color: colors.primary }]}>₺{balance.toLocaleString("tr-TR")}</Text>
                            </View>
                            <MaterialIcons name="account-balance-wallet" size={32} color={colors.primary} />
                        </View>
                    )}
                </View>

                <View style={styles.divider} />

                {/* Settings Links */}
                <View style={styles.linksSection}>
                    <TouchableOpacity style={styles.linkItem} onPress={() => router.push("/account-info")}>
                        <MaterialIcons name="info-outline" size={24} color={colors.text} />
                        <Text style={styles.linkText}>Hesap Bilgilerim</Text>
                        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>

                    {isCompanyOwner && (
                        <TouchableOpacity style={styles.linkItem} onPress={() => router.push("/corporate-info")}>
                            <MaterialIcons name="business" size={24} color={colors.primary} />
                            <Text style={[styles.linkText, { color: colors.primary }]}>Firma Yönetim Paneli (Çalışan/Borç)</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    )}


                    <TouchableOpacity style={styles.linkItem} onPress={() => router.push("/support" as any)}>
                        <MaterialIcons name="support-agent" size={24} color={colors.text} />
                        <Text style={styles.linkText}>Mutfakla İletişime Geç (İstek/Öneri)</Text>
                        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    </TouchableOpacity>

                    {/* Uygulama Geri Bildirimi — Feedback Modal Tetikleyici */}
                    <TouchableOpacity style={[styles.linkItem, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' }]} onPress={() => setFeedbackModalVisible(true)}>
                        <MaterialIcons name="rate-review" size={24} color={colors.primary} />
                        <Text style={[styles.linkText, { color: colors.primary }]}>Uygulama Hakkında Görüşünüzü Paylaşın</Text>
                        <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                    </TouchableOpacity>

                    <View style={styles.linkItem}>
                        <MaterialIcons name="notifications-none" size={24} color={colors.text} />
                        <Text style={styles.linkText}>Bildirimler</Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={handleToggleNotifications}
                            trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={24} color={colors.danger} />
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>

            </ScrollView>

            <Modal
                visible={feedbackModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setFeedbackModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView 
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={{ width: '100%' }}
                        >
                            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                                <View style={styles.modalContainer}>
                                    <View style={styles.modalHeader}>
                                        <MaterialIcons name="rate-review" size={28} color={colors.primary} />
                                        <Text style={styles.modalTitle}>Görüşünüzü Paylaşın</Text>
                                    </View>
                                    <Text style={styles.modalSubtitle}>
                                        Uygulamayı daha iyi yapabilmemiz için düşüncelerinizi bizimle paylaşın. Her geri bildirim bizim için değerli! 💬
                                    </Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Deneyiminizi, önerilerinizi veya karşılaştığınız sorunları buraya yazabilirsiniz..."
                                        placeholderTextColor={colors.muted}
                                        value={feedbackText}
                                        onChangeText={setFeedbackText}
                                        multiline
                                        numberOfLines={5}
                                        textAlignVertical="top"
                                        maxLength={500}
                                    />
                                    <Text style={[styles.modalSubtitle, { textAlign: 'right', marginTop: 4, fontSize: 11 }]}>
                                        {feedbackText.length}/500
                                    </Text>
                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder }]}
                                            onPress={() => { setFeedbackModalVisible(false); setFeedbackText(""); }}
                                            disabled={feedbackSending}
                                        >
                                            <Text style={[styles.modalBtnText, { color: colors.text }]}>Vazgeç</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 1.5 }]}
                                            onPress={handleSendFeedback}
                                            disabled={feedbackSending || !feedbackText.trim()}
                                        >
                                            {feedbackSending ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Gönder 🚀</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

        </SafeAreaView>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '900', color: colors.text },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

    imageSection: { alignItems: 'center', marginVertical: 24 },
    imageContainer: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.surface,
        borderWidth: 2, borderColor: colors.surfaceBorder,
        overflow: 'hidden', position: 'relative'
    },
    profileImage: { width: '100%', height: '100%' },
    imageOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', height: 32,
        alignItems: 'center', justifyContent: 'center'
    },

    formSection: { gap: 16 },
    label: { fontSize: 12, fontWeight: 'bold', color: colors.muted, marginBottom: -8, marginLeft: 4 },
    roleBadgeContainer: {
        alignItems: 'center', marginBottom: 8, marginTop: -8
    },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '40'
    },
    roleText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder,
        paddingHorizontal: 16, height: 56
    },
    input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
    saveBtn: {
        backgroundColor: colors.primary, height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', marginTop: 8
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    divider: { height: 1, backgroundColor: colors.surfaceBorder, marginVertical: 32 },

    linksSection: { gap: 16 },
    linkItem: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: colors.surface, padding: 16, borderRadius: 16,
        borderWidth: 1, borderColor: colors.surfaceBorder
    },
    linkText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.dangerBg, padding: 16, borderRadius: 16,
        marginTop: 32, borderWidth: 1, borderColor: colors.dangerBorder
    },
    logoutText: { color: colors.danger, fontSize: 16, fontWeight: 'bold' },
    debtCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        marginTop: 16,
        borderWidth: 1,
        borderColor: colors.primary + '30'
    },
    debtLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    debtAmount: { fontSize: 24, fontWeight: '900' },

    // Feedback Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 28,
        paddingBottom: 40,
        gap: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0f172a',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 20,
    },
    modalInput: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#0f172a',
        minHeight: 130,
        backgroundColor: '#f8fafc',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    modalBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
    },
});
