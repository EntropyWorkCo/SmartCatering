const printStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; background: white; color: #1e293b; }
  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
`;

function openPrintWindow(html: string, filename: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Lütfen açılır pencere engelleyiciyi kapatın ve tekrar deneyin.');
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="utf-8"/>
      <title>${filename}</title>
      <style>${printStyle}</style>
    </head>
    <body>
      ${html}
      <div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:12px;z-index:999;">
        <button onclick="window.print()" style="background:#1a2e4a;color:white;border:none;padding:14px 28px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;">
          📄 PDF OLARAK İNDİR
        </button>
        <button onclick="window.close()" style="background:#f1f5f9;color:#64748b;border:none;padding:14px 28px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;">
          Kapat
        </button>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
}

export const pdfService = {

  generateSalesReport: (orders: any[], period: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');

    const validOrders = orders.filter(o =>
      !['CANCELLED', 'İPTAL', 'İptal'].includes((o.status || '').toUpperCase())
    );

    const revenue = validOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const mealCount = validOrders.reduce((acc, o) =>
      acc + (o.adisyon_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0);

    // --- Şirket bazlı gruplama ---
    const groupMap: Record<string, { name: string; orders: any[]; total: number }> = {};
    validOrders.forEach(o => {
      const key = o.companyName || '__bireysel__';
      if (!groupMap[key]) groupMap[key] = { name: o.companyName || 'Bireysel Müşteriler', orders: [], total: 0 };
      groupMap[key].orders.push(o);
      groupMap[key].total += o.total_amount || 0;
    });

    // Kurumsal önce, bireysel sona
    const sortedGroups = Object.values(groupMap).sort((a, b) => {
      if (a.name === 'Bireysel Müşteriler') return 1;
      if (b.name === 'Bireysel Müşteriler') return -1;
      return b.total - a.total;
    });

    const statusMap: any = { PAID: 'ÖDENDİ', COMPLETED: 'TAMAMLANDI', PENDING: 'BEKLİYOR', PREPARING: 'HAZIRLANIYOR', READY: 'YOLDA', CANCELLED: 'İPTAL' };

    const groupSections = sortedGroups.map(group => {
      const rows = group.orders.map((o, idx) => {
        const items = o.adisyon_items?.map((i: any) => `${i.quantity}× ${i.menu_items?.name || 'Ürün'}`).join(', ') || 'Hizmet';
        const status = statusMap[(o.status || '').toUpperCase()] || o.status;
        const isPaid = ['PAID', 'COMPLETED', 'ÖDENDİ', 'TAMAMLANDI'].includes((o.status || '').toUpperCase());
        return `
          <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;">${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:700;">${o.userName || 'Müşteri'}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#475569;">${items}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:900;color:${isPaid ? '#10b981' : '#f97316'};">${status}</td>
          </tr>`;
      }).join('');

      return `
        <div style="margin-bottom:40px;page-break-inside:avoid;">
          <!-- Şirket Başlığı -->
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-left:5px solid #1a2e4a;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:12px;">
            <div>
              <div style="font-size:15px;font-weight:900;color:#1e293b;">${group.name}</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${group.orders.length} İşlem</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Dönem Toplamı</div>
              <div style="font-size:18px;font-weight:900;color:#1a2e4a;">₺${group.total.toLocaleString('tr-TR')}</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#e8edf5;">
                <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">Tarih</th>
                <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">Müşteri</th>
                <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">Ürünler</th>
                <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">Durum</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;font-style:italic;font-size:11px;">Kayıt yok</td></tr>'}</tbody>
          </table>
        </div>`;
    }).join('');

    const html = `
      <div style="padding:40px;max-width:960px;margin:0 auto;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #f1f5f9;">
          <div>
            <div style="background:#1a2e4a;color:white;padding:10px 20px;border-radius:8px;font-weight:900;font-size:20px;display:inline-block;margin-bottom:8px;">MEYDAN LOKANTA</div>
            <p style="margin:0;color:#64748b;font-size:14px;font-weight:600;">Satış &amp; Tahsilat Raporu — Şirket Bazlı</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#64748b;">Dönem: <strong style="color:#1e293b;">${period}</strong></div>
            <div style="font-size:12px;color:#64748b;">Oluşturuldu: <strong style="color:#1e293b;">${dateStr}</strong></div>
          </div>
        </div>

        <!-- Genel Özet -->
        <div style="display:flex;gap:24px;margin-bottom:48px;">
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;padding:24px;border-radius:16px;">
            <div style="font-size:10px;font-weight:900;color:#15803d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">DÖNEM CİROSU</div>
            <div style="font-size:30px;font-weight:900;color:#1e293b;">₺${revenue.toLocaleString('tr-TR')}</div>
          </div>
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:24px;border-radius:16px;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">TOPLAM ÖĞÜN</div>
            <div style="font-size:30px;font-weight:900;color:#1e293b;">${mealCount} <span style="font-size:15px;color:#64748b;">Adet</span></div>
          </div>
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:24px;border-radius:16px;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">ŞİRKET SAYISI</div>
            <div style="font-size:30px;font-weight:900;color:#1e293b;">${sortedGroups.filter(g => g.name !== 'Bireysel Müşteriler').length} <span style="font-size:15px;color:#64748b;">Firma</span></div>
          </div>
        </div>

        <!-- Şirket Bazlı Detaylar -->
        <h3 style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">ŞİRKET BAZLI İŞLEM DETAYLARI</h3>
        ${groupSections}

        <!-- Footer -->
        <div style="margin-top:60px;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:10px;">
          Bu belge Meydan Lokanta İşletme Otomasyonu tarafından otomatik olarak oluşturulmuştur.<br/>
          © ${now.getFullYear()} Meydan Lokanta | Tüm Hakları Saklıdır.
        </div>
      </div>
    `;

    openPrintWindow(html, `satis_raporu_${period}_${dateStr.replace(/\./g, '-')}`);
  },

  generateCompanyExtre: (account: any, orders: any[]) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');
    const debt = account.isCorporate ? account.manualDebt : account.total;

    const filteredOrders = orders.filter((o: any) => {
      const note = (o.note || '').toUpperCase();
      return !note.includes('BORCA AKTARILDI');
    });

    // Tarihe göre sırala (Yeni en üstte)
    filteredOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const rows = filteredOrders.map((o: any, idx: number) => {
      const isManual = o.order_type === 'MANUAL_DEBT' || o.order_type === 'MANUAL_PAYMENT';
      const isPayment = o.order_type === 'MANUAL_PAYMENT';
      const isDebt = o.order_type === 'MANUAL_DEBT';

      let items = o.adisyon_items?.map((i: any) => `${i.quantity}× ${i.menu_items?.name || 'Ürün'}`).join(', ') || 'Hizmet';
      if (isManual) items = o.note || (isPayment ? 'Ödeme' : 'Ek Borç');

      const isPaid = ['PAID', 'COMPLETED', 'ÖDENDİ', 'TAMAMLANDI'].includes((o.status || '').toUpperCase());
      
      let statusLabel = isPaid ? 'TAMAMLANDI' : 'BEKLİYOR';
      let statusColor = isPaid ? '#10b981' : '#f97316';

      if (isPayment) {
        statusLabel = 'ÖDEME';
        statusColor = '#10b981';
      } else if (isDebt) {
        statusLabel = 'BORÇ';
        statusColor = '#ef4444';
      }

      return `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}">
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;">${new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:700;">${o.userName || 'Personel'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;">${items}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:900;color:${statusColor};">${statusLabel}</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="padding:40px;max-width:900px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #f1f5f9;">
          <div>
            <div style="background:#1a2e4a;color:white;padding:10px 20px;border-radius:8px;font-weight:900;font-size:20px;display:inline-block;margin-bottom:8px;">MEYDAN LOKANTA</div>
            <p style="margin:0;color:#64748b;font-size:14px;font-weight:600;">Hizmet Detay &amp; Borç Ekstresi</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#64748b;">Tarih: <strong style="color:#1e293b;">${dateStr}</strong></div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-bottom:32px;">
          <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:6px;">MÜŞTERİ / FİRMA ÜNVANI</div>
          <div style="font-size:20px;font-weight:900;color:#1e293b;">${account.displayName}</div>
        </div>

        <h3 style="font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">HİZMET VE İŞLEM DETAYLARI</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:40px;">
          <thead>
            <tr style="background:#1a2e4a;color:white;">
              <th style="padding:12px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;">Tarih</th>
              <th style="padding:12px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;">Müşteri</th>
              <th style="padding:12px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;">Hizmet</th>
              <th style="padding:12px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;">Durum</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" style="padding:40px;text-align:center;color:#94a3b8;font-style:italic;">Kayıt bulunmamaktadır.</td></tr>'}</tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:24px;border-radius:16px;min-width:280px;text-align:right;">
            <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">GÜNCEL TOPLAM BORÇ</div>
            <div style="font-size:28px;font-weight:900;color:${debt <= 0 ? '#10b981' : '#ef4444'};">
              ${debt <= 0 ? 'ÖDENDİ ✓' : `₺${debt.toLocaleString('tr-TR')}`}
            </div>
          </div>
        </div>

        <div style="margin-top:60px;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:10px;">
          Bu belge bilgilendirme amaçlı otomatik olarak oluşturulmuştur.<br/>
          © ${now.getFullYear()} Meydan Lokanta | Yönetim Paneli
        </div>
      </div>
    `;

    openPrintWindow(html, `ekstre_${account.displayName}_${dateStr.replace(/\./g, '-')}`);
  }
};
