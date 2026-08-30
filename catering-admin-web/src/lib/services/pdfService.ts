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

  generateSalesReport: (orders: any[], period: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');

    const validOrders = orders.filter(o => {
      if (['CANCELLED', 'İPTAL', 'İptal'].includes((o.status || '').toUpperCase())) return false;
      if (o.order_type === 'MANUAL_PAYMENT') return false;
      return true;
    });

    const revenue = validOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);

    const mealCount = validOrders
      .filter(o => o.order_type !== 'MANUAL_DEBT' && o.order_type !== 'MANUAL_PAYMENT')
      .reduce((acc, o) =>
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
    const debt = (account.isCorporate ? account.manualDebt : account.total) ?? 0;

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
  },

  /**
   * Banka ekstresi formatında PDF üretir (Web Tarayıcı Uyumlu)
   * Bölüm 1: Tüketim kayıtları (yemek siparişleri)
   * Bölüm 2: Finansal hareketler (MANUAL_DEBT / MANUAL_PAYMENT) + cari bakiye
   */
  generateHesapEkstresi: (data: any) => {
    const { firma, mealOrders, financialEntries, adisyonlar, donem, ekstreNo, kalanBorc } = data;
    const now = new Date();
    const genTime = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const meals: any[] = mealOrders || (adisyonlar || []).filter((a: any) =>
      a.order_type === 'Şimdi Ye' || a.order_type === 'Sipariş Ver'
    );
    const financial: any[] = financialEntries || (adisyonlar || []).filter((a: any) =>
      a.order_type === 'MANUAL_DEBT' || a.order_type === 'MANUAL_PAYMENT'
    );

    // Ay Kapanışı marker'larının tarihleri (total_amount=0 olan MANUAL_DEBT kayıtları)
    const ayKapanisDateSet = new Set<string>(
      financial
        .filter((e: any) => e.order_type === 'MANUAL_DEBT' && !(e.total_amount > 0))
        .map((e: any) => new Date(e.created_at).toLocaleDateString('tr-TR'))
    );

    // Devir girişi: Ay Kapanışı günü girilen, 0 TL olmayan MANUAL_DEBT kayıtları
    const isCarryOver = (e: any): boolean =>
      e.order_type === 'MANUAL_DEBT' &&
      (e.total_amount > 0) &&
      ayKapanisDateSet.has(new Date(e.created_at).toLocaleDateString('tr-TR'));

    const carryOverTotal = financial
      .filter(isCarryOver)
      .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

    // Tabldot türü dağılımı
    const tabldotMap: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    meals.forEach((m: any) => {
      (m.adisyon_items || []).forEach((i: any) => {
        if (Array.isArray(i.selections) && i.selections.length >= 2) {
          const sc = Math.min(i.selections.length, 4);
          tabldotMap[sc] += (i.quantity || 1);
          return;
        }
        const cat: string = i.menu_items?.category || '';
        const nm: string = i.menu_items?.name || '';
        if (cat === 'TABLDOT' || nm.toUpperCase().includes('TABLDOT') || nm.toUpperCase().includes('PAKET')) {
          let sc = 4;
          if (nm.includes('2') || nm.toUpperCase().includes('2 ÇEŞİT') || nm.toUpperCase().includes('İKİ') || nm.toUpperCase().includes('IKI')) sc = 2;
          else if (nm.includes('3') || nm.toUpperCase().includes('3 ÇEŞİT') || nm.toUpperCase().includes('ÜÇ') || nm.toUpperCase().includes('UC')) sc = 3;
          tabldotMap[sc] += (i.quantity || 1);
        }
      });
    });

    const dotColors: Record<number, string> = { 4: '#185FA5', 3: '#1D9E75', 2: '#BA7517' };
    const tabldotOzetRows = ([4, 3, 2] as const)
      .filter(sc => tabldotMap[sc] > 0)
      .map(sc => `<tr><td style="padding:8px 14px;font-size:12px;color:#1e293b;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColors[sc]};margin-right:8px;vertical-align:middle;"></span>${sc}'lü Tabldot</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;color:#1a2e4a;">${tabldotMap[sc]} adet</td></tr>`)
      .join('');
    const totalTabldot = tabldotMap[2] + tabldotMap[3] + tabldotMap[4];

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
      const carryOver = isCarryOver(f);
      const isMarker = isDebt && !(f.total_amount > 0);
      const bg = carryOver ? '#fefce8' : isMarker ? '#f0fdf4' : (i % 2 === 1 ? '#f8fafc' : '#fff');
      const ds = new Date(f.created_at).toLocaleDateString('tr-TR');
      const note = f.note || '';
      const lbl = !isDebt
        ? ('Odeme Alindi' + (note ? ' - ' + note : ''))
        : isMarker
        ? ('Ay Kapanis' + (note ? ': ' + note.replace(/✅\s*/, '') : ''))
        : carryOver
        ? ('Onceki Donem Devri' + (note ? ' - ' + note : ''))
        : ('Donem Borcu' + (note ? ' - ' + note : ''));
      const amt = f.total_amount || 0;
      const col = isDebt ? '#dc2626' : '#16a34a';
      const sign = isDebt ? '+' : '-';
      runBal += isDebt ? amt : -amt;
      const balCol = runBal > 0 ? '#dc2626' : runBal < 0 ? '#16a34a' : '#1e293b';
      return `<tr style="background:${bg};"><td style="padding:8px 12px;font-size:11px;color:#64748b;">${ds}</td><td style="padding:8px 12px;font-size:12px;color:${col};font-weight:600;">${lbl}</td><td style="padding:8px 12px;font-size:13px;color:${col};font-weight:700;text-align:right;">${sign}${formatCurrency(amt)}</td><td style="padding:8px 12px;font-size:13px;color:${balCol};font-weight:800;text-align:right;">${formatCurrency(runBal)}</td></tr>`;
    }).join('');

    const manualDebt = financial.filter((e: any) => e.order_type === 'MANUAL_DEBT').reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    const totalDebt = data.toplamBorc !== undefined ? data.toplamBorc : manualDebt;
    const totalPaid = data.toplamOdenen !== undefined
      ? data.toplamOdenen
      : financial.filter((e: any) => e.order_type === 'MANUAL_PAYMENT').reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

    const devirRow = carryOverTotal > 0
      ? `<div class="s-row" style="color:#92400e;font-style:italic;">
          <span>Ay Kapanis Tahsilati:</span>
          <span>-${formatCurrency(carryOverTotal)}</span>
         </div>`
      : '';

    const html = `
      <div style="padding:40px;max-width:900px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:30px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;">
          <div>
            <div style="font-size:26px;font-weight:900;color:#1a2e4a;">MEYDAN LOKANTA</div>
            <div style="font-size:13pt;color:#e8a020;font-weight:bold;margin-top:4px;">HESAP EKSTRESİ</div>
          </div>
          <div style="text-align:right;font-size:10px;color:#64748b;">
            <div><b>Eks. No:</b> ${ekstreNo}</div>
            <div><b>Donem:</b> ${formatDate(donem.baslangic)} - ${formatDate(donem.bitis)}</div>
            <div><b>Olusturma:</b> ${genTime}</div>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px 20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
          <div style="font-size:16px;font-weight:bold;color:#1a2e4a;">${firma?.company_name || 'Kurumsal Musteri'}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">V.No: ${firma?.tax_number || '-'} | Tel: ${firma?.company_phone || '-'}<br/>Adres: ${firma?.address || '-'}</div>
        </div>
        <div style="font-size:11px;font-weight:900;color:#1a2e4a;margin:24px 0 8px 0;text-transform:uppercase;border-left:4px solid #e8a020;padding-left:10px;">TUKETIM KAYITLARI (${meals.length} ogun)</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;width:100px;">Tarih</th><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;width:60px;">Saat</th><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;width:150px;">Personel</th><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;">Siparis Detayi</th></tr>
          </thead>
          <tbody>${tuketimRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">Bu donemde tuketim kaydi bulunmamaktadir.</td></tr>'}</tbody>
        </table>
        ${totalTabldot > 0 ? `
        <div style="font-size:11px;font-weight:900;color:#1a2e4a;margin:24px 0 8px 0;text-transform:uppercase;border-left:4px solid #e8a020;padding-left:10px;">TABLDOT OZETI</div>
        <table style="width:280px;border-collapse:collapse;margin-bottom:16px;">
          <thead><tr><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;">Tabldot Turu</th><th style="background:#1a2e4a;color:#fff;text-align:right;padding:10px 12px;font-size:10px;text-transform:uppercase;width:90px;">Adet</th></tr></thead>
          <tbody>${tabldotOzetRows}</tbody>
          <tfoot><tr style="background:#f8fafc;"><td style="padding:9px 14px;font-size:13px;font-weight:900;color:#1a2e4a;border-top:1px solid #e2e8f0;">TOPLAM</td><td style="padding:9px 14px;font-size:13px;font-weight:900;text-align:right;color:#185FA5;border-top:1px solid #e2e8f0;">${totalTabldot} adet</td></tr></tfoot>
        </table>` : ''}
        <div class="page-break"></div>
        <div style="font-size:11px;font-weight:900;color:#1a2e4a;margin:24px 0 8px 0;text-transform:uppercase;border-left:4px solid #e8a020;padding-left:10px;">FINANSAL HAREKETLER</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;width:100px;">Tarih</th><th style="background:#1a2e4a;color:#fff;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;">Hareket</th><th style="background:#1a2e4a;color:#fff;text-align:right;padding:10px 12px;font-size:10px;text-transform:uppercase;width:110px;">Tutar</th><th style="background:#1a2e4a;color:#fff;text-align:right;padding:10px 12px;font-size:10px;text-transform:uppercase;width:120px;">Cari Bakiye</th></tr>
          </thead>
          <tbody>${finRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">Bu donemde finansal hareket bulunmamaktadir.</td></tr>'}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;">
          <div style="width:320px;">
            <div class="s-row" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;"><span>Donem Borc Toplami:</span><span style="color:#dc2626;font-weight:700;">${formatCurrency(totalDebt)}</span></div>
            <div class="s-row" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;"><span>Donem Odeme Toplami:</span><span style="color:#16a34a;font-weight:700;">${formatCurrency(totalPaid)}</span></div>
            ${devirRow}
            <div class="s-row total" style="display:flex;justify-content:space-between;padding:14px 0 8px 0;font-weight:900;font-size:16px;color:${(kalanBorc || 0) > 0 ? '#dc2626' : '#16a34a'};"><span>DONEM SONU BAKIYE:</span><span>${formatCurrency(kalanBorc || 0)}</span></div>
          </div>
        </div>
        <div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:9px;color:#94a3b8;text-align:center;">Bu doküm Meydan Lokanta Akilli Catering Sistemi tarafindan otomatik olusturulmustur. Ekstre No: ${ekstreNo}</div>
      </div>
    `;

    const filename = `ekstre_${firma?.company_name || 'Musteri'}_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}`;
    openPrintWindow(html, filename);
  }
};
