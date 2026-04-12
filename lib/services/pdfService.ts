import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const COLORS = {
    NAVY: '#1a2e4a', // Reverted to professional Navy
    AMBER: '#e8a020',
    TEXT: '#1a1a2e',
    MUTED: '#6b7280',
    BORDER: '#e5e7eb',
    WHITE: '#ffffff',
    GRAY_BG: '#f3f4f6',
    ZEBRA_BG: '#f5f8fb',
    DANGER: '#dc2626',
    SUCCESS: '#16a34a',
    WARNING: '#f59e0b',
    INFO: '#2563eb',
    WARNING_BG: '#fffbeb',
    SUCCESS_BG: '#f0fdf4',
    INFO_BG: '#eff6ff'
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ₺';
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const pdfService = {
    generateEkstreHTML: (data: any) => {
        const { firma, yemekler, adisyonlar, donem, ekstreNo, kalanBorc, toplamYemekSayisi, yemekGenelToplam, toplamBorc, toplamOdenen } = data;
        const now = new Date();
        const generationTime = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        // 1. Manuel Hizmet Bedellerini dökümden gizliyoruz (Kullanıcı istemiyor)
        const mealRows = ""; // Tüm manuel yemek kayıtları gizlendi
        
        // 2. Personel Siparişleri (Adisyonlar) - Tablo Satırları (GRUPLAYARAK)
        const groupedAdisyons: { [key: string]: any } = {};
        (adisyonlar || []).forEach((a: any) => {
            // Manuel kayıtları ve sistem notlarını gizle
            const note = (a.note || "").toUpperCase();
            if (note.includes("BORCA AKTARILDI") || note.includes("BORÇ AKTARILDI") || a.order_type === 'MANUAL_DEBT' || a.order_type === 'MANUAL_PAYMENT') return;

            const dateStr = new Date(a.created_at).toLocaleDateString('tr-TR');
            const userStr = a.users?.full_name || 'Misafir';
            const key = `${dateStr}_${userStr}`;

            if (!groupedAdisyons[key]) {
                groupedAdisyons[key] = { ...a, count: 1, items: [...(a.adisyon_items || [])] };
            } else {
                groupedAdisyons[key].count += 1;
                if (a.adisyon_items) groupedAdisyons[key].items.push(...a.adisyon_items);
            }
        });

        const adisyonRows = Object.values(groupedAdisyons).map((a: any, index: number) => {
            const rowClass = index % 2 === 1 ? 'zebra' : '';
            const dateObj = new Date(a.created_at);
            const dateStr = dateObj.toLocaleDateString('tr-TR');
            const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            const itemsStr = a.items?.map((i: any) => i.menu_items?.name).join(', ') || 'Sipariş';

            return `
                <tr class="${rowClass}">
                    <td style="padding: 8px;"><strong>${a.users?.full_name || 'Misafir'}</strong> ${a.count > 1 ? `<span style="color:#1a2e4a;">(x${a.count})</span>` : ''}</td>
                    <td style="text-align: center; padding: 8px;">${dateStr}</td>
                    <td style="text-align: center; padding: 8px;">${timeStr}</td>
                    <td style="padding: 8px;">${itemsStr}</td>
                </tr>
            `;
        }).join('');

        return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; margin: 0; padding: 40px; line-height: 1.5; background: #fff; }
                .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                .brand { font-size: 28px; font-weight: 900; color: #1a2e4a; margin: 0; }
                .title { font-size: 14pt; color: #e8a020; font-weight: bold; margin-top: 5px; }
                .meta { text-align: right; font-size: 10px; color: #64748b; }
                
                .firm-box { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
                .firm-name { font-size: 16px; font-weight: bold; color: #1a2e4a; margin-bottom: 5px; }
                .firm-details { font-size: 11px; color: #64748b; }

                .section-title { font-size: 12px; font-weight: 900; color: #1a2e4a; margin: 30px 0 10px 0; text-transform: uppercase; border-left: 4px solid #e8a020; padding-left: 10px; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #1a2e4a; color: white; text-align: left; padding: 12px; font-size: 10px; text-transform: uppercase; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
                .zebra { background: #fdfdfd; }

                .summary-container { display: flex; justify-content: flex-end; margin-top: 20px; margin-bottom: 40px; }
                .summary-table { width: 300px; border-top: 2px solid #1a2e4a; }
                .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
                .summary-row.total { font-weight: 900; font-size: 16px; color: #dc2626; border-bottom: none; padding-top: 15px; }

                .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; }
                
                @media print {
                    .page-break { page-break-before: always; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="brand">MEYDAN LOKANTA</div>
                    <div class="title">HESAP EKSTRESİ</div>
                </div>
                <div class="meta">
                    <div><b>Eks. No:</b> ${ekstreNo}</div>
                    <div><b>Dönem:</b> ${formatDate(donem.baslangic)} - ${formatDate(donem.bitis)}</div>
                    <div><b>Tar:</b> ${generationTime}</div>
                </div>
            </div>

            <div class="firm-box">
                <div class="firm-name">${firma?.company_name || 'Kurumsal Müşteri'}</div>
                <div class="firm-details">
                    V.No: ${firma?.tax_number || '-'} &nbsp; | &nbsp; Tel: ${firma?.company_phone || '-'} <br/>
                    Adres: ${firma?.address || '-'}
                </div>
            </div>

            <div class="section-title">YEMEK TÜKETİM ÖZETİ (Admin Girişli)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="width: 120px;">Tarih</th>
                        <th>Hizmet / Yemek Adı</th>
                    </tr>
                </thead>
                <tbody>
                    ${mealRows || '<tr><td colspan="3" style="text-align:center;">Bu dönemde admin girişli kayıt bulunmamaktadır.</td></tr>'}
                </tbody>
            </table>

            <div class="summary-container">
                <div class="summary-table">
                    <div class="summary-row">
                        <span>Dönem İçi Tüketim Toplamı:</span>
                        <span>${formatCurrency(yemekGenelToplam)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Önceki Dönemden Devreden Borç:</span>
                        <span>${formatCurrency(kalanBorc - yemekGenelToplam)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>GÜNCEL TOPLAM BORÇ:</span>
                        <span>${formatCurrency(kalanBorc)}</span>
                    </div>
                </div>
            </div>

            ${adisyonlar ? `
            <div class="page-break"></div>
            <div class="section-title">PERSONEL DETAYLI SİPARİŞ KAYITLARI</div>
            <table style="margin-top: 10px;">
                <thead>
                    <tr>
                        <th style="width: 30%;">Personel</th>
                        <th style="width: 15%; text-align: center;">Tarih</th>
                        <th style="width: 10%; text-align: center;">Saat</th>
                        <th style="width: 45%;">Sipariş Detayı</th>
                    </tr>
                </thead>
                <tbody>
                    ${adisyonRows.length > 0 ? adisyonRows : '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #94a3b8;">Bu dönemde kaydedilmiş personel siparişi bulunamadı.</td></tr>'}
                </tbody>
            </table>
            ` : ''}

            <div class="footer">
                Bu döküm Meydan Lokanta Akıllı Catering Sistemi tarafından oluşturulmuştur.<br/>
                Afiyet Olsun.
            </div>
        </body>
        </html>
        `;
    },

    generateAndShareEkstre: async (data: any) => {
        const html = pdfService.generateEkstreHTML(data);
        const { firma, donem } = data;
        const fileName = `Ekstre_${firma.company_name.replace(/\s/g, '_')}_${donem.baslangic.replace(/-/g, '')}.pdf`;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (Platform.OS === 'ios') {
                await Sharing.shareAsync(uri);
            } else {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
            return uri;
        } catch (error) {
            console.error("PDF oluşturma/paylaşma hatası:", error);
            throw error;
        }
    }
};
