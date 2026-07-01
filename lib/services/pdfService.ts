import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' TL';
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const BASE_CSS = `
    body{font-family:Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;line-height:1.5;background:#fff;}
    .header{border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-end;}
    .brand{font-size:26px;font-weight:900;color:#1a2e4a;}
    .title{font-size:13pt;color:#e8a020;font-weight:bold;margin-top:4px;}
    .meta{text-align:right;font-size:10px;color:#64748b;}
    .firm-box{background:#f8fafc;padding:16px 20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;}
    .firm-name{font-size:16px;font-weight:bold;color:#1a2e4a;}
    .firm-details{font-size:11px;color:#64748b;margin-top:4px;}
    .section-title{font-size:11px;font-weight:900;color:#1a2e4a;margin:24px 0 8px 0;text-transform:uppercase;border-left:4px solid #e8a020;padding-left:10px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;}
    td{border-bottom:1px solid #f1f5f9;}
    .footer{margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:9px;color:#94a3b8;text-align:center;}
    @media print{.page-break{page-break-before:always;}}
`;

export const pdfService = {

    generateEkstreHTML: (data: any) => {
        const { firma, adisyonlar, donem, ekstreNo, kalanBorc, yemekGenelToplam } = data;
        const now = new Date();
        const genTime = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const manualEntries = (adisyonlar || []).filter((a: any) =>
            a.order_type === 'MANUAL_DEBT' || a.order_type === 'MANUAL_PAYMENT'
        );

        const mealRows = manualEntries.map((m: any, idx: number) => {
            const ds = new Date(m.created_at).toLocaleDateString('tr-TR');
            const isDebt = m.order_type === 'MANUAL_DEBT';
            const lbl = isDebt ? `Donem Borcu (${m.note || '-'})` : `Odeme Alindi (${m.note || '-'})`;
            const col = isDebt ? '#dc2626' : '#16a34a';
            return `<tr><td style="text-align:center;padding:8px;">${idx + 1}</td><td style="padding:8px;">${ds}</td><td style="padding:8px;"><strong style="color:${col};">${lbl}</strong></td></tr>`;
        }).join('');

        const grouped: Record<string, any> = {};
        (adisyonlar || []).forEach((a: any) => {
            if (a.order_type === 'MANUAL_DEBT' || a.order_type === 'MANUAL_PAYMENT') return;
            const ds = new Date(a.created_at).toLocaleDateString('tr-TR');
            const us = a.users?.full_name || 'Misafir';
            const k = ds + '_' + us;
            if (!grouped[k]) grouped[k] = { ...a, count: 1, items: [...(a.adisyon_items || [])] };
            else { grouped[k].count++; if (a.adisyon_items) grouped[k].items.push(...a.adisyon_items); }
        });

        const aRows = Object.values(grouped).map((a: any, idx: number) => {
            const bg = idx % 2 === 1 ? '#fdfdfd' : 'transparent';
            const ds = new Date(a.created_at).toLocaleDateString('tr-TR');
            const ts = new Date(a.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const its = (a.items || []).map((i: any) => (i.quantity > 1 ? i.quantity + 'x ' : '') + (i.menu_items?.name || 'Yemek')).join(', ') || 'Siparis';
            return `<tr style="background:${bg};"><td style="padding:8px;"><strong>${a.users?.full_name || 'Misafir'}</strong>${a.count > 1 ? ` (x${a.count})` : ''}</td><td style="text-align:center;padding:8px;">${ds}</td><td style="text-align:center;padding:8px;">${ts}</td><td style="padding:8px;">${its}</td></tr>`;
        }).join('');

        const totalDebt = yemekGenelToplam || 0;
        const prevDebt = (kalanBorc || 0) - totalDebt;

        return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><style>${BASE_CSS}
            .summary-container{display:flex;justify-content:flex-end;margin-top:20px;margin-bottom:40px;}
            .summary-table{width:300px;border-top:2px solid #1a2e4a;}
            .summary-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
            .summary-row.total{font-weight:900;font-size:16px;color:#dc2626;border-bottom:none;padding-top:15px;}
        </style></head><body>
        <div class="header">
            <div><div class="brand">MEYDAN LOKANTA</div><div class="title">HESAP EKSTRESI</div></div>
            <div class="meta"><div><b>Eks. No:</b> ${ekstreNo}</div><div><b>Donem:</b> ${formatDate(donem.baslangic)} - ${formatDate(donem.bitis)}</div><div><b>Tarih:</b> ${genTime}</div></div>
        </div>
        <div class="firm-box">
            <div class="firm-name">${firma?.company_name || 'Kurumsal Musteri'}</div>
            <div class="firm-details">V.No: ${firma?.tax_number || '-'} | Tel: ${firma?.company_phone || '-'}<br/>Adres: ${firma?.address || '-'}</div>
        </div>
        <div class="section-title">YEMEK TUKETIM / FINANSAL KAYITLAR</div>
        <table>
            <thead><tr><th style="width:40px;text-align:center;">#</th><th style="width:120px;">Tarih</th><th>Hareket</th></tr></thead>
            <tbody>${mealRows || '<tr><td colspan="3" style="text-align:center;padding:16px;color:#94a3b8;">Kayit bulunamadi.</td></tr>'}</tbody>
        </table>
        <div class="summary-container"><div class="summary-table">
            <div class="summary-row"><span>Donem Toplami:</span><span>${formatCurrency(totalDebt)}</span></div>
            <div class="summary-row"><span>Onceki Donemden Devir:</span><span>${formatCurrency(prevDebt)}</span></div>
            <div class="summary-row total"><span>GUNCEL TOPLAM BORC:</span><span>${formatCurrency(kalanBorc || 0)}</span></div>
        </div></div>
        ${adisyonlar ? `<div class="page-break"></div>
        <div class="section-title">PERSONEL SIPARIS KAYITLARI</div>
        <table>
            <thead><tr><th style="width:30%;">Personel</th><th style="width:15%;text-align:center;">Tarih</th><th style="width:10%;text-align:center;">Saat</th><th>Siparis Detayi</th></tr></thead>
            <tbody>${aRows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#94a3b8;">Kayit bulunamadi.</td></tr>'}</tbody>
        </table>` : ''}
        <div class="footer">Bu doküm Meydan Lokanta Akilli Catering Sistemi tarafindan olusturulmustur. Afiyet Olsun.</div>
        </body></html>`;
    },

    /**
     * Banka ekstresi formatinda PDF uretir.
     * Bolum 1: Tuketim kayitlari (yemek siparisleri)
     * Bolum 2: Finansal hareketler (MANUAL_DEBT / MANUAL_PAYMENT) + cari bakiye
     */
    generateHesapEkstresi: (data: any) => {
        const { firma, mealOrders, financialEntries, adisyonlar, donem, ekstreNo, kalanBorc } = data;
        const now = new Date();
        const genTime = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const meals: any[] = mealOrders || (adisyonlar || []).filter((a: any) =>
            a.order_type === 'Simdi Ye' || a.order_type === 'Siparis Ver'
        );
        const financial: any[] = financialEntries || (adisyonlar || []).filter((a: any) =>
            a.order_type === 'MANUAL_DEBT' || a.order_type === 'MANUAL_PAYMENT'
        );

        const tuketimRows = meals.map((m: any, i: number) => {
            const bg = i % 2 === 1 ? '#f8fafc' : '#fff';
            const ds = new Date(m.created_at).toLocaleDateString('tr-TR');
            const ts = new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const per = m.users?.full_name || 'Personel';
            const its = (m.adisyon_items || []).map((it: any) => (it.quantity > 1 ? it.quantity + 'x ' : '') + (it.menu_items?.name || 'Yemek')).join(', ') || 'Tabldot';
            return `<tr style="background:${bg};"><td style="padding:8px 12px;font-size:11px;color:#64748b;">${ds}</td><td style="padding:8px 12px;font-size:11px;color:#64748b;">${ts}</td><td style="padding:8px 12px;font-size:12px;color:#1e293b;font-weight:500;">${per}</td><td style="padding:8px 12px;font-size:11px;color:#475569;">${its}</td></tr>`;
        }).join('');

        const periodNet = financial.reduce((s: number, e: any) =>
            e.order_type === 'MANUAL_DEBT' ? s + (e.total_amount || 0) : s - (e.total_amount || 0), 0);
        let runBal = (kalanBorc || 0) - periodNet;

        const finRows = financial.map((f: any, i: number) => {
            const isDebt = f.order_type === 'MANUAL_DEBT';
            const bg = i % 2 === 1 ? '#f8fafc' : '#fff';
            const ds = new Date(f.created_at).toLocaleDateString('tr-TR');
            const note = f.note || '';
            const lbl = !isDebt ? ('Odeme Alindi' + (note ? ' - ' + note : ''))
                : note.includes('Ay Kapanis') ? ('Ay Kapalisi - ' + note)
                : ('Donem Borcu' + (note ? ' - ' + note : ''));
            const amt = f.total_amount || 0;
            const col = isDebt ? '#dc2626' : '#16a34a';
            const sign = isDebt ? '+' : '-';
            runBal += isDebt ? amt : -amt;
            const balCol = runBal > 0 ? '#dc2626' : '#16a34a';
            return `<tr style="background:${bg};"><td style="padding:8px 12px;font-size:11px;color:#64748b;">${ds}</td><td style="padding:8px 12px;font-size:12px;color:${col};font-weight:600;">${lbl}</td><td style="padding:8px 12px;font-size:13px;color:${col};font-weight:700;text-align:right;">${sign}${formatCurrency(amt)}</td><td style="padding:8px 12px;font-size:13px;color:${balCol};font-weight:800;text-align:right;">${formatCurrency(runBal)}</td></tr>`;
        }).join('');

        const totalDebt = financial.filter((e: any) => e.order_type === 'MANUAL_DEBT').reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
        const totalPaid = financial.filter((e: any) => e.order_type === 'MANUAL_PAYMENT').reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

        return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><style>${BASE_CSS}
            .summary-box{display:flex;justify-content:flex-end;}
            .summary-table{width:320px;}
            .s-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
            .s-row.total{font-weight:900;font-size:16px;border-bottom:none;padding-top:14px;}
        </style></head><body>
        <div class="header">
            <div><div class="brand">MEYDAN LOKANTA</div><div class="title">HESAP EKSTRESI</div></div>
            <div class="meta"><div><b>Eks. No:</b> ${ekstreNo}</div><div><b>Donem:</b> ${formatDate(donem.baslangic)} - ${formatDate(donem.bitis)}</div><div><b>Olusturma:</b> ${genTime}</div></div>
        </div>
        <div class="firm-box">
            <div class="firm-name">${firma?.company_name || 'Kurumsal Musteri'}</div>
            <div class="firm-details">V.No: ${firma?.tax_number || '-'} | Tel: ${firma?.company_phone || '-'}<br/>Adres: ${firma?.address || '-'}</div>
        </div>
        <div class="section-title">TUKETIM KAYITLARI (${meals.length} ogun)</div>
        <table>
            <thead><tr><th style="width:100px;">Tarih</th><th style="width:60px;">Saat</th><th style="width:150px;">Personel</th><th>Siparis Detayi</th></tr></thead>
            <tbody>${tuketimRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">Bu donemde tuketim kaydi bulunmamaktadir.</td></tr>'}</tbody>
        </table>
        <div class="page-break"></div>
        <div class="section-title">FINANSAL HAREKETLER</div>
        <table>
            <thead><tr><th style="width:100px;">Tarih</th><th>Hareket</th><th style="width:110px;text-align:right;">Tutar</th><th style="width:120px;text-align:right;">Cari Bakiye</th></tr></thead>
            <tbody>${finRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">Bu donemde finansal hareket bulunmamaktadir.</td></tr>'}</tbody>
        </table>
        <div class="summary-box"><div class="summary-table">
            <div class="s-row"><span>Donem Borc Toplami:</span><span style="color:#dc2626;">${formatCurrency(totalDebt)}</span></div>
            <div class="s-row"><span>Donem Odeme Toplami:</span><span style="color:#16a34a;">${formatCurrency(totalPaid)}</span></div>
            <div class="s-row total"><span>GUNCEL TOPLAM BORC:</span><span style="color:#dc2626;">${formatCurrency(kalanBorc || 0)}</span></div>
        </div></div>
        <div class="footer">Bu doküm Meydan Lokanta Akilli Catering Sistemi tarafindan otomatik olusturulmustur. Ekstre No: ${ekstreNo}</div>
        </body></html>`;
    },

    generateAndShareEkstre: async (data: any) => {
        const html = pdfService.generateEkstreHTML(data);
        const { firma, donem } = data;
        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (Platform.OS === 'ios') {
                await Sharing.shareAsync(uri);
            } else {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
            return uri;
        } catch (error) {
            console.error("PDF olusturma/paylasma hatasi:", error);
            throw error;
        }
    }
};
