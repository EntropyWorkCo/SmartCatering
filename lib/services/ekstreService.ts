import { supabase } from "../supabase";

/**
 * Ekstre (Hizmet & Borç dökümü) için gerekli tüm verileri çeker.
 * Yemek ve Borç verileri iki ayrı sorgu ile alınır.
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

            // 2. Yemek kayıtlarını getir (SADECE yemek_kayitlari tablosu) - HATA KORUMALI
            let yemekListe: any[] = [];
            try {
                const { data: yemekler, error: yemeklerError } = await supabase
                    .from('yemek_kayitlari' as any)
                    .select('*')
                    .eq('firma_id', firmaId)
                    .gte('tarih', baslangicTarihi)
                    .lte('tarih', bitisTarihi)
                    .order('tarih', { ascending: true });

                if (yemeklerError) {
                    if (yemeklerError.code === '42501') {
                        console.warn("Yemek kayıtlarına erişim izni yok, boş liste ile devam ediliyor.");
                    } else {
                        throw yemeklerError;
                    }
                } else {
                    yemekListe = yemekler || [];
                }
            } catch (err) {
                console.error("Yemek kayıtları çekilirken hata (yok sayıldı):", err);
            }

            // 3. Borç geçmişini getir (SADECE aylik_borclar tablosu - son 6 ay) - HATA KORUMALI
            let borcListe: any[] = [];
            try {
                const { data: borclar, error: borclarError } = await supabase
                    .from('aylik_borclar' as any)
                    .select('*')
                    .eq('firma_id', firmaId)
                    .order('yil', { ascending: false })
                    .order('ay', { ascending: false })
                    .limit(6);

                if (borclarError) {
                    if (borclarError.code === '42501') {
                        console.warn("Borç geçmişine erişim izni yok, boş liste ile devam ediliyor.");
                    } else {
                        throw borclarError;
                    }
                } else {
                    borcListe = borclar || [];
                }
            } catch (err) {
                console.error("Borç geçmişi çekilirken hata (yok sayıldı):", err);
            }

            // 4. Personel adisyonlarını getir - HATA KORUMALI & BASİTLEŞTİRİLMİŞ
            let adisyonListe: any[] = [];
            try {
                // Not: users!inner yerine daha garanti bir yöntemle çekiyoruz
                const { data: adisyonlar, error: adisyonError } = await supabase
                    .from('adisyon')
                    .select(`
                        id,
                        created_at,
                        total_amount,
                        order_type,
                        user_id,
                        users (full_name, company_id),
                        adisyon_items (
                            quantity,
                            menu_items (name)
                        )
                    `)
                    .gte('created_at', `${baslangicTarihi}T00:00:00`)
                    .lte('created_at', `${bitisTarihi}T23:59:59`)
                    .order('created_at', { ascending: true });

                if (!adisyonError && adisyonlar) {
                    // Bu şirkete ait personelleri VEYA şirket sahibinin kendisini filtrele
                    adisyonListe = adisyonlar.filter((a: any) => 
                        a.users?.company_id === firmaId || a.user_id === firma.user_id
                    );
                }
            } catch (err) {
                console.error("Adisyonlar çekilirken hata:", err);
            }

            // 5. İstatistikleri hesapla
            const toplamYemekSayisi = yemekListe.reduce((acc, y) => acc + (y.kisi || 0), 0);
            const yemekGenelToplam = yemekListe.reduce((acc, y) => acc + (y.toplam || 0), 0);
            
            const toplamBorc = borcListe.reduce((acc, b) => acc + (b.toplam_borc || 0), 0);
            const toplamOdenen = borcListe.reduce((acc, b) => acc + (b.odenen_tutar || 0), 0);
            
            // Bakiyeyi HER ZAMAN ana mizan tablosundan (companies.balance) alıyoruz.
            // Bu sayede Dashboard rakamı ile PDF rakamı asla karışmaz.
            const kalanBorc: number = (firma.balance !== undefined && firma.balance !== null) ? firma.balance : 0;

            // Ekstre numarası oluştur (EKS-YIL-AY-RANDOM)
            const now = new Date();
            const ekstreNo = `EKS-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

            return {
                firma,
                yemekler: yemekListe,
                borclar: borcListe,
                adisyonlar: adisyonListe,
                donem: { baslangic: baslangicTarihi, bitis: bitisTarihi },
                ekstreNo,
                toplamYemekSayisi,
                yemekGenelToplam,
                toplamBorc,
                toplamOdenen,
                kalanBorc
            };
        } catch (error) {
            console.error("getEkstreVerisi hatası:", error);
            throw error;
        }
    }
};
