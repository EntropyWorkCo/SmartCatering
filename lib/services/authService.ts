import { supabase } from '../supabase';

// Gerçek TopluSMS API Entegrasyonu
export const sendOtp = async (phone: string): Promise<boolean> => {
    try {
        // 1. 6 Haneli Rastgele Kod Üret
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Supabase otp_codes tablosuna kaydet
        const { error: dbError } = await supabase
            .from('otp_codes' as any)
            .insert([{ phone, code: otpCode }] as any);
            
        if (dbError) {
            console.error("OTP Veritabanı Kayıt Hatası:", dbError);
            return false;
        }

        // 3. İletiMerkezi (POST JSON) API İsteği
        // Not: Çevre değişkenlerini .env'nizden alıyoruz. Expo'da EXPO_PUBLIC_ ön eki gerekir.
        const apiKey = process.env.EXPO_PUBLIC_SMS_KEY || "";
        const apiHash = process.env.EXPO_PUBLIC_SMS_HASH || "";
        const sender = process.env.EXPO_PUBLIC_SMS_SENDER || "";

        // İletiMerkezi telefon numarasını 5xxxxxxxxx formatında bekliyor
        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        
        const messageText = `SmartCatering onay kodunuz: ${otpCode}. Lütfen kimseyle paylaşmayın.`;

        const apiUrl = "https://api.iletimerkezi.com/v1/send-sms/json";
        const payload = {
            request: {
                authentication: {
                    key: apiKey,
                    hash: apiHash
                },
                order: {
                    sender: sender,
                    iys: "0",
                    message: {
                        text: messageText,
                        receipents: {
                            number: [cleanPhone]
                        }
                    }
                }
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        console.log("IletiMerkezi Ham Cevap:", rawText);

        try {
            const jsonData = JSON.parse(rawText);
            
            if (jsonData?.response?.status?.code == 200 || jsonData?.response?.status?.code === "200") {
                return true;
            } else {
                console.error("IletiMerkezi Hata (401 vb):", jsonData);
                return false;
            }
        } catch (e) {
            console.error("IletiMerkezi JSON okunamadı, cevap parçalanamıyor:", rawText);
            return false;
        }
    } catch (error) {
        console.error("OTP Gönderim Hatası:", error);
        return false;
    }
};

/**
 * Kullanıcının girdiği OTP kodunu doğrular.
 * @param phone Telefon numarası
 * @param code Kullanıcının girdiği 6 haneli kod
 */
export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
    try {
        // En son geçerli olan kodu çek (kullanılmamış ve 5 dakika içinde üretilmiş)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { data, error } = await (supabase
            .from('otp_codes' as any)
            .select('*')
            .eq('phone', phone)
            .eq('code', code)
            .eq('is_used', false)
            .gte('created_at', fiveMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .single() as any);

        if (error || !data) {
            console.error("OTP Doğrulama Hatası veya Süresi Dolmuş:", error?.message);
            return false;
        }

        // Kodu kullanıldı olarak işaretle
        await supabase
            .from('otp_codes' as any)
            .update({ is_used: true } as any)
            .eq('id', data.id);

        return true;
    } catch (e) {
         console.error("verifyOtp Hatası:", e);
         return false;
    }
};

/**
 * Telefon formatını normalize eder (baştaki satırları ve 0'ı siler).
 * @param phone Ham telefon string'i
 * @returns 5 ile başlayan 10 haneli format veya null
 */
export const normalizePhone = (phone: string): string | null => {
    let cleaned = phone.replace(/\D/g, "");
    
    // 0 ile başlıyorsa (05XX...)
    if (cleaned.length === 11 && cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
    }
    
    // Başına +90 gelmemişse (5XX...)
    if (cleaned.length === 10 && cleaned.startsWith("5")) {
        return `+90${cleaned}`;
    }
    
    // Zaten 90 ile başlıyorsa (905XX...)
    if (cleaned.length === 12 && cleaned.startsWith("90")) {
        return `+${cleaned}`;
    }

    // Tam format ( +905XX... )
    if (cleaned.length === 13 && cleaned.startsWith("90")) {
        // Zaten + karakteri temizlendiği için length 12 olur ama eğer bir şekilde gelirse diye
        return `+${cleaned}`;
    }
    
    // Eğer temizlenmiş hali 10 hane değilse ve 5 ile başlamıyorsa geçersizdir
    if (cleaned.length !== 10 || !cleaned.startsWith("5")) {
        // Eğer zaten +90 formatındaysa (12 hane rakam olarak)
        if (cleaned.length === 12 && cleaned.startsWith("90")) {
             return `+${cleaned}`;
        }
        return null;
    }
    
    return `+90${cleaned}`;
};
