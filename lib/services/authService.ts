import { supabase } from '../supabase';

// Supabase Edge Function üzerinden İletiMerkezi API entegrasyonu
export const sendOtp = async (phone: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase.functions.invoke('send-otp', {
            body: { phone }
        });

        if (error || !data?.success) {
            console.error("OTP Gönderim Hatası (Edge Function):", error?.message || data?.error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Beklenmeyen OTP Gönderim Hatası:", error);
        return false;
    }
};

/**
 * Edge Function üzerinden OTP kodunu doğrular.
 * @param phone Telefon numarası
 * @param code Kullanıcının girdiği 6 haneli kod
 */
export const verifyOtp = async (phone: string, code: string): Promise<any> => {
    try {
        const { data, error } = await supabase.functions.invoke('verify-otp', {
            body: { phone, code },
        });

        if (error) {
            console.error("verifyOtp Hatası:", error);
            return { success: false, error: error.message };
        }

        if (data && data.success) {
            return data; // { success: true, user_exists: true/false, access_token, etc. }
        } else {
            return { success: false, error: data?.error || "Doğrulama başarısız" };
        }
    } catch (e: any) {
         console.error("verifyOtp Hatası:", e);
         return { success: false, error: e.message };
    }
};

/**
 * Yeni kullanıcıyı güvenli şekilde kayıt eder (register-user Edge Function üzerinden).
 * OTP doğrulandıktan sonra çağrılır. auth.users + public.users atomik oluşturulur,
 * ardından generateLink+verifyOtp ile gerçek session döner — fake password yok.
 */
export const registerUser = async (params: {
    phone: string;
    name: string;
    role: 'owner' | 'individual' | 'employee';
    companyName?: string;
    vkn?: string;
    address?: string;
}): Promise<{ success: boolean; auto_login?: boolean; access_token?: string; refresh_token?: string; error?: string }> => {
    try {
        const { data, error } = await supabase.functions.invoke('register-user', {
            body: params,
        });

        if (error) {
            console.error('registerUser Hatası:', error);
            return { success: false, error: error.message };
        }

        return data;
    } catch (e: any) {
        console.error('registerUser Hatası:', e);
        return { success: false, error: e.message };
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
