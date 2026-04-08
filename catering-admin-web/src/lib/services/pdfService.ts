// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ReportData {
  firma_adi: string;
  vkn: string;
  firma_adres: string;
  firma_telefon: string;
  ekstre_no: string;
  donem_araligi: string;
  dokuman_tarihi: string;
  devreden_bakiye: number;
  bu_donemin_borcu: number;
  guncel_toplam_borc: number;
  islemler: Array<{
    tarih: string;
    aciklama: string;
    tutar: string;
  }>;
}

export const pdfService = {
  generateCompanyReport: async (data: ReportData) => {
    const template = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 40px; background: white; width: 800px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;">
            <div style="flex: 1;">
                <div style="background: #0f172a; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-style: italic; display: inline-block; font-size: 20px;">MEYDAN LOKANTA</div>
            </div>
            <div style="flex: 1; text-align: right;">
                <h1 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase;">MÜŞTERİ HESAP ÖZETİ</h1>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Seçili Dönem: <strong>${data.donem_araligi}</strong></div>
            </div>
        </div>

        <!-- YENİ ÜST KISIM (ÖZET & TOPLAM BORÇ) -->
        <div style="margin-bottom: 40px;">
            <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Müşteri: ${data.firma_adi}</div>
            
            <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr>
                    <td style="padding: 12px 20px; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0;">Geçmişten Devreden Borç <em>(Dönem Öncesi)</em></td>
                    <td style="padding: 12px 20px; font-size: 14px; font-weight: bold; text-align: right; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${(data.devreden_bakiye || 0).toLocaleString('tr-TR')} TL</td>
                </tr>
                <tr>
                    <td style="padding: 12px 20px; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0;">Bu Dönemin Borcu <em>(${data.donem_araligi})</em></td>
                    <td style="padding: 12px 20px; font-size: 14px; font-weight: bold; text-align: right; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${(data.bu_donemin_borcu || 0).toLocaleString('tr-TR')} TL</td>
                </tr>
                <tr style="background: #eef2ff;">
                    <td style="padding: 16px 20px; font-size: 16px; font-weight: 900; color: #dc2626;">🔴 GÜNCEL TOPLAM BORCUNUZ</td>
                    <td style="padding: 16px 20px; font-size: 20px; font-weight: 900; text-align: right; color: #dc2626;">${(data.guncel_toplam_borc || 0).toLocaleString('tr-TR')} TL</td>
                </tr>
            </table>
        </div>

        <!-- ALT KISIM (TÜKETİM DETAYLARI) -->
        <div>
            <h2 style="font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                Seçili Dönemde (${data.donem_araligi}) Alınan Hizmetler / Detaylar:
            </h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tbody>
                    ${data.islemler.length > 0 
                      ? data.islemler.map(i => `
                          <tr>
                              <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; width: 120px; color: #64748b;">${i.tarih}</td>
                              <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 500;">✔️ ${i.aciklama}</td>
                          </tr>
                      `).join('') 
                      : `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Bu döneme ait kayıt bulunmamaktadır.</td></tr>`
                    }
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 60px; padding-top: 30px; border-top: 2px solid #f1f5f9; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
            <div style="font-style: italic;">Bu belge sistem tarafından otomatik oluşturulmuştur. Döküman Tarihi: ${data.dokuman_tarihi}</div>
            <div style="font-weight: 700; color: #64748b;">Meydan Lokanta</div>
        </div>
    </div>
    `;

    // --- Modern CSS (oklch) Fix: Iframe Isolation ---
    // Creating a hidden iframe to render the PDF in a clean environment
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px'; // strictly match template width
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      throw new Error("Iframe dökümanı oluşturulamadı.");
    }

    const opt = {
      margin: 10,
      filename: `ekstre_${data.firma_adi.toLowerCase().replace(/ /g, '_')}_${data.dokuman_tarihi.replace(/\./g, '-')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 800, // Forces html2canvas to render at exactly 800px avoiding shifts
        ignoreElements: (element: Element) => element.tagName === 'STYLE' || element.tagName === 'LINK'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    // Standard HTML structure with basic reset
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin: 0; padding: 0;">
        <div style="width: 800px; background: white; -webkit-print-color-adjust: exact;">
          ${template}
        </div>
      </body>
      </html>
    `);
    iframeDoc.close();

    try {
      // Ensure html2pdf is a function (Vite/ESM compatibility)
      const exporter = typeof (html2pdf as any) === 'function' ? html2pdf : (html2pdf as any).default;
      if (typeof exporter === 'function') {
        const content = iframeDoc.body.firstElementChild as HTMLElement;
        await exporter().from(content).set(opt).save();
      } else {
        throw new Error("PDF kütüphanesi yüklenemedi.");
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      throw err;
    } finally {
      document.body.removeChild(iframe);
    }
  }
};
