import { supabase } from "../supabase";

/**
 * Ekstre (Hesap Ekstresi) için gerekli tüm verileri adisyon tablosundan çeker.
 * yemek_kayitlari / aylik_borclar eski boş tablolara bakılmaz.
 */
export const ekstreService = {
    async getEkstreVerisi(firmaId: string, baslangicTarihi: string, bitisTarihi: string) {
        try {
            // 1. Şirket bilgilerini getir
            const { data: firma, error: firmaError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', firmaId)
                .single();

            if (firmaError) throw firmaError;

            const companyUserId: string = firma.user_id;

            // 2. Şirket personellerinin id'lerini getir
            const { data: employees } = await supabase
                .from('users')
                .select('id')
                .eq('company_id', firmaId);

            const employeeIds: string[] = (employees || []).map((e: any) => e.id);
            if (companyUserId && !employeeIds.includes(companyUserId)) {
                employeeIds.push(companyUserId);
            }

            // 3. MANUAL_DEBT / MANUAL_PAYMENT — firma sahibinin user_id'si ile kaydedilir
            // +03:00 ekliyoruz: Türkiye UTC+3, gece yarısı oluşturulan kayıtlar UTC'de önceki güne kayar
            const { data: financialEntries } = await supabase
                .from('adisyon')
                .select('id, created_at, total_amount, order_type, note, user_id, status')
                .eq('user_id', companyUserId)
                .in('order_type', ['MANUAL_DEBT', 'MANUAL_PAYMENT'])
                .gte('created_at', `${baslangicTarihi}T00:00:00+03:00`)
                .lte('created_at', `${bitisTarihi}T23:59:59+03:00`)
                .order('created_at', { ascending: true });

            // 4. Yemek siparişleri — tüm çalışanların adisyonları
            const { data: mealOrders } = await supabase
                .from('adisyon')
                .select(`
                    id, created_at, total_amount, order_type, note, user_id, status,
                    users (full_name, company_id),
                    adisyon_items (
                        quantity,
                        selections,
                        menu_items (name, category)
                    )
                `)
                .in('user_id', employeeIds)
                .in('order_type', ['Şimdi Ye', 'Sipariş Ver'])
                .gte('created_at', `${baslangicTarihi}T00:00:00+03:00`)
                .lte('created_at', `${bitisTarihi}T23:59:59+03:00`)
                .order('created_at', { ascending: true });

            // 5. Finansal özet (adisyon tablosundan)
            const fEntries = financialEntries || [];
            const mOrders = mealOrders || [];

            const toplamBorc = fEntries
                .filter((e: any) => e.order_type === 'MANUAL_DEBT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

            const toplamOdenen = fEntries
                .filter((e: any) => e.order_type === 'MANUAL_PAYMENT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

            const toplamYemekSayisi = mOrders.length;

            // Dönem sonu bakiye: şu anki bakiyeden, dönem SONRASI girilen borç/ödemeleri çıkar/ekle
            // Bu sayede geçmiş ay PDFi "o anki bakiye"yi değil "dönem sonu bakiyesi"ni gösterir
            const { data: postPeriodEntries } = await supabase
                .from('adisyon')
                .select('total_amount, order_type')
                .eq('user_id', companyUserId)
                .in('order_type', ['MANUAL_DEBT', 'MANUAL_PAYMENT'])
                .gt('created_at', `${bitisTarihi}T23:59:59+03:00`);

            const postDebt = (postPeriodEntries || [])
                .filter((e: any) => e.order_type === 'MANUAL_DEBT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
            const postPayment = (postPeriodEntries || [])
                .filter((e: any) => e.order_type === 'MANUAL_PAYMENT')
                .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

            // Dönem sonu bakiye = güncel bakiye - dönem sonrası borçlar + dönem sonrası ödemeler
            const kalanBorc: number = (firma.balance ?? 0) - postDebt + postPayment;

            // Ekstre no
            const now = new Date();
            const ekstreNo = `EKS-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

            // adisyonlar: PDF'de geriye uyumluluk için eski alan
            const adisyonlar = [...fEntries, ...mOrders].sort(
                (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            return {
                firma,
                adisyonlar,
                mealOrders: mOrders,
                financialEntries: fEntries,
                donem: { baslangic: baslangicTarihi, bitis: bitisTarihi },
                ekstreNo,
                toplamYemekSayisi,
                yemekGenelToplam: toplamBorc,   // eski alan adı, geriye uyumluluk
                toplamBorc,
                toplamOdenen,
                kalanBorc,
            };
        } catch (error) {
            console.error("getEkstreVerisi hatası:", error);
            throw error;
        }
    }
};
