import { supabase } from '../supabase';

// Supabase Edge Function üzerinden İletiMerkezi API entegrasyonu
export const sendOtp = async (phone: string): Promise<boolean> => {
    try {
        const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
        const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

        // SDK yerine direkt fetch kullanarak kütüphane hatalarını bypass ediyoruz
        const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey
            },
            body: JSON.stringify({ phone })
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
            console.error("OTP Gönderim Hatası (Direct Fetch):", data?.error || response.status);
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
        const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
        const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

        const response = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey
            },
            body: JSON.stringify({ phone, code }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return data;
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

/**
 * Mevcut oturumdaki kullanıcının hesabını güvenli şekilde siler.
 * Rol bazlı silme mantığı delete-account Edge Function içinde çalışır.
 * @returns { success, code?, error? }
 *   code = 'DEBT' → ödenmemiş borç var
 */
export const deleteAccount = async (): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'Aktif oturum bulunamadı.' };
    }

    // Supabase bilgilerini manuel kullanıyoruz (process.env bazen undefined gelebilir)
    const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.log('JSON Parse Hatası (Ham Metin):', rawText);
    }

    if (!response.ok) {
      const finalError = data.error || data.message || `Sunucu Hatası (${response.status}): ${rawText.substring(0, 50)}`;
      console.error('deleteAccount hatası detaylı:', { status: response.status, finalError });
      
      return { 
        success: false, 
        code: data.code, 
        error: finalError
      };
    }

    return data;
  } catch (e: any) {
    console.error('deleteAccount beklenmeyen hata:', e);
    return { success: false, error: e.message };
  }
};
