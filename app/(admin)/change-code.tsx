import ThemeSwitcher from "@/components/ThemeSwitcher"; //tema değiştirme butonu
import Colors from "@/constants/Colors"; // tema renklerini tutan dosya
import { useResolvedTheme } from "@/lib/store/themeStore"; // aktif temayı döndürür. (light-dark)
import { supabase } from "@/lib/supabase"; // supabase client. auth,database,storage işlemleri yapılır
import { MaterialIcons } from "@expo/vector-icons"; // google material ikonları
import { router } from "expo-router"; // expo router navigation system
import React, { useState } from "react";
import {
    Alert, // popup
    ScrollView, // scroll
    StyleSheet,
    Text, //yazı
    TextInput,
    TouchableOpacity, // button
    View, // container
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; //Telefonun notch / status bar alanına çarpmamak için kullanılır

export default function AdminChangeCode() {
    const insets = useSafeAreaInsets();

    const theme = useResolvedTheme();
    const colors = Colors[theme];        // tema renkleri
    const styles = getStyles(colors);    // stil

    const [oldCode, setOldCode] = useState(""); // mevcut kod
    const [newCode, setNewCode] = useState(""); // yeni kod
    const [confirmCode, setConfirmCode] = useState(""); // onay kodu

    const [loading, setLoading] = useState(false); // loading state

    const handleSave = async () => {
        if (!oldCode || !newCode || !confirmCode) {  // tüm alanlar doldurulup doldurulmadığını kontrol eder
            Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
            return;
        }
        if (newCode !== confirmCode) {
            Alert.alert("Hata", "Yeni kodlar eşleşmiyor!");  // yeni kodlar eşleşmiyor mu kontrol eder
            return;
        }
        if (newCode.length < 4) {
            Alert.alert("Hata", "Kod en az 4 haneli olmalıdır."); // yeni kodun uzunluğu kontrol eder
            return;
        }

        setLoading(true);
        try {
            // 1. Kullanıcının mevcut e-postasını al
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) throw new Error("Kullanıcı oturumu bulunamadı.");

            // 2. Mevcut parolası (kodu) doğru mu diye teyit et
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: oldCode,
            });

            if (signInError) {
                setLoading(false);
                Alert.alert("Hata", "Mevcut kodunuz (parola) hatalı!");
                return;
            }

            // 3. Doğrulandıysa yeni parolayı (kodu) belirle
            const { error: updateError } = await supabase.auth.updateUser({
                password: newCode      // supabase de auth.users.password değerini değiştirir
            });

            if (updateError) throw updateError;

            Alert.alert("Başarılı", "Erişim kodu (Parola) başarıyla değiştirildi.");
            router.back();
        } catch (err: any) {  // hata kontrolü
            Alert.alert("Hata", "Kod güncellenirken bir hata oluştu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Kodu Değiştir</Text>
                </View>
                <ThemeSwitcher />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>MEVCUT ERİŞİM KODU</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={oldCode}
                            onChangeText={setOldCode}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>YENİ ERİŞİM KODU</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={newCode}
                            onChangeText={setNewCode}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>YENİ KODU ONAYLA</Text>
                        <TextInput
                            style={styles.input}
                            secureTextEntry
                            keyboardType="number-pad"
                            value={confirmCode}
                            onChangeText={setConfirmCode}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                    <MaterialIcons name="lock-reset" size={24} color={colors.background} />
                    <Text style={styles.saveBtnText}>Kodu Güncelle</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({  // tema destekli stil sistemi,React Native’in stil optimizasyon sistemi.
    container: {
        flex: 1, //Bu View ekranın tamamını kaplasın.flexbox mantığı
        backgroundColor: colors.background, //arka plan rengi 
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
        marginBottom: 24, // Header ile aşağıdaki içerik arasına boşluk koyar.
    },
    backButton: {
        width: 40, 
        height: 40, // buton boyutu
        borderRadius: 20, // kenar yuvarlatma
        backgroundColor: colors.surface, // buton arka plan rengi
        alignItems: "center", // buton içindeki elementlerin ortalanması
        justifyContent: "center", // buton içindeki elementlerin ortalanması
        borderWidth: 1, // kenarlık
        borderColor: colors.surfaceBorder, // kenarlık rengi
        marginRight: 16, // buton ile sağ kenar boşluğu
    },
    title: { fontSize: 24, fontWeight: "900", color: colors.text }, // başlık
    scrollContent: { // scroll content
        paddingHorizontal: 24, // yatay boşluk
        paddingBottom: 40, // alt boşluk
    },
    formContainer: {
        marginBottom: 24, // form ile alt kenar boşluğu
    },
    inputGroup: {
        marginBottom: 24, // input ile alt kenar boşluğu
    },
    inputLabel: {
        fontSize: 10,   // etiket boyutu
        fontWeight: "900", // etiket kalınlığı
        color: colors.muted, // etiket rengi
        textTransform: "uppercase", // etiket büyük harf
        letterSpacing: 2, // etiket harf arası boşluk
        marginBottom: 12, // etiket ile alt kenar boşluğu
        marginLeft: 4, // etiket ile sol kenar boşluğu
    },
    input: {
        backgroundColor: colors.surface,    // input arka plan rengi
        borderRadius: 24, // kenar yuvarlatma
        paddingVertical: 20, // input dikey boşluk
        paddingHorizontal: 24, // input yatay boşluk
        fontSize: 24, // input boyutu
        fontWeight: "900", // input kalınlığı
        letterSpacing: 10, // input harf arası boşluk
        color: colors.text, // input rengi
        textAlign: "center", // input içindeki elementlerin ortalanması
        borderWidth: 1, // kenarlık
        borderColor: colors.surfaceBorder, // kenarlık rengi
    },
    divider: {
        height: 1, // ayırıcı boyutu
        backgroundColor: colors.surfaceBorder, // ayırıcı rengi
        marginVertical: 8, // ayırıcı ile alt kenar boşluğu
        marginBottom: 32, // ayırıcı ile alt kenar boşluğu
    },
    saveBtn: {
        flexDirection: "row", // yatay dizayn
        alignItems: "center", // elementlerin ortalanması
        justifyContent: "center", // elementlerin ortalanması
        gap: 12, // elementler arası boşluk
        backgroundColor: colors.primary, // buton arka plan rengi
        paddingVertical: 24, // buton dikey boşluk
        borderRadius: 24,
    },  
    saveBtnText: { // buton metin
        color: colors.background, // buton rengi
        fontSize: 14, // buton boyutu
        fontWeight: "900", // buton kalınlığı
    },
});
