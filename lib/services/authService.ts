import { supabase } from '../supabase';

// Geçiçi Test OTP Kodu (Mentör AWS ayarlayana kadar her zaman bu kod geçerli olacak)
export const TEST_OTP_CODE = "123456";

/**
 * Kullanıcıya OTP kodu gönderir.
 * Gerçekte bu fonksiyon AWS SNS üzerinden SMS atacak.
 * Şimdilik konsola logluyor ve başarılı dönüyor.
 * @param phone 5xxxxxxxxx formatında telefon numarası
 */
export const sendOtp = async (phone: string): Promise<boolean> => {
    try {
        // AWS Entegrasyonu: İleride Mentör AWS'yi bağladığında
        // const response = await fetch('https://aws-api...', { method: 'POST', body: JSON.stringify({ phone, message: `Kodunuz: ${TEST_OTP_CODE}` }) });
        // return response.ok;

        console.log(`[MOCK SMS] Numaraya giden onay kodu: ${TEST_OTP_CODE} -> Numara: ${phone}`);

        // Sahte gecikme (Ağ simülasyonu)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return true;
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
    // Şimdilik sadece TEST_OTP_CODE ile eşleştiriyoruz.
    // İleride veritabanında tutulan geçici kodlarla karşılaştırılabilir.
    
    // Sahte gecikme (Ağ simülasyonu)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return code === TEST_OTP_CODE;
};

/**
 * Telefon formatını normalize eder (baştaki satırları ve 0'ı siler).
 * @param phone Ham telefon string'i
 * @returns 5 ile başlayan 10 haneli format veya null
 */
export const normalizePhone = (phone: string): string | null => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length !== 10 || !cleaned.startsWith("5")) {
        return null;
    }
    
    return cleaned;
};
