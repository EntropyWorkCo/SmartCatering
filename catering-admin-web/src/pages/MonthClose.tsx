import { useState } from "react";
import { 
  CalendarRange, 
  Play, 
  Info, 
  Loader2, 
  AlertOctagon, 
  CheckCircle2, 
  Building2, 
  Receipt,
  FileText
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { billingService } from "../lib/services/billingService";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

export default function MonthClose() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executingClose, setExecutingClose] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  const [previewData, setPreviewData] = useState<{
    affectedOrders: number;
    totalAmount: number;
    affectedFirms: number;
    companiesList: { company_name: string; balance: number }[];
  } | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTextInput, setConfirmTextInput] = useState("");

  const handleFetchPreview = async () => {
    setLoadingPreview(true);
    setPreviewData(null);
    setSuccessResult(null);
    try {
      const year = selectedYear;
      const month = selectedMonth;
      
      const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const CLOSED_STATUSES = '("PAID","Ödendi","ÖDENDİ","CANCELLED","İptal","COMPLETED","Tamamlandı")';
      const EXCLUDED_TYPES  = '("MANUAL_PAYMENT","MANUAL_DEBT")';

      // 1. Kurumsal çalışanları bul
      const [ownerRes, empRes] = await Promise.all([
        supabase.from("companies").select("user_id").not("user_id", "is", null),
        supabase.from("users").select("id").not("company_id", "is", null).neq("role", "deleted"),
      ]);
      const corporateUserIds = [
        ...(ownerRes.data || []).map((c) => c.user_id),
        ...(empRes.data  || []).map((u) => u.id),
      ].filter(Boolean);

      // 2. Kapanacak sipariş sayısını hesapla
      let q = supabase
        .from("adisyon")
        .select("id, total_amount, user_id")
        .lte("created_at", endDate)
        .not("status", "in", CLOSED_STATUSES)
        .not("order_type", "in", EXCLUDED_TYPES);

      if (corporateUserIds.length > 0) {
        q = q.in("user_id", corporateUserIds);
      } else {
        q = q.in("user_id", ["non-existent-user-id"]);
      }

      const { data: summary, error: summaryErr } = await q;
      if (summaryErr) throw summaryErr;

      // 3. Borçlu firmaları bul
      const { data: allDebted, error: debtErr } = await supabase
        .from("companies")
        .select("company_name, balance")
        .gt("balance", 0);
      if (debtErr) throw debtErr;

      const affectedOrders = summary?.length ?? 0;
      const totalAmount = (allDebted || []).reduce((s, c) => s + (c.balance || 0), 0);
      const affectedFirms = allDebted?.length ?? 0;

      setPreviewData({
        affectedOrders,
        totalAmount,
        affectedFirms,
        companiesList: (allDebted || []).map((c: any) => ({
          company_name: c.company_name,
          balance: c.balance ?? 0
        }))
      });
    } catch (err: any) {
      console.error(err);
      alert("Önizleme verileri alınırken hata oluştu: " + err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteClose = async () => {
    if (confirmTextInput !== "KAPAT") {
      alert("Lütfen onay alanına büyük harflerle KAPAT yazın.");
      return;
    }

    setExecutingClose(true);
    setShowConfirmModal(false);
    try {
      const result = await billingService.closeMonthAdmin(selectedYear, selectedMonth);
      setSuccessResult({
        ...result,
        monthName: `${MONTHS[selectedMonth - 1]} ${selectedYear}`
      });
      setPreviewData(null);
      setConfirmTextInput("");
    } catch (err: any) {
      console.error(err);
      alert("Ay kapanışı gerçekleştirilirken bir hata oluştu: " + err.message);
    } finally {
      setExecutingClose(false);
    }
  };

  const yearsList = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    yearsList.push(y);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarRange className="text-accent" size={32} /> Ay Kapanış Modülü
        </h1>
        <p className="text-slate-500 mt-1">Seçilen ay için tüm kurumsal firmaların bekleyen adisyonlarını kapatın ve bakiyeleri sıfırlayın.</p>
      </div>

      {/* Info Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-start space-x-4 shadow-sm">
        <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
          <Info size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Ay Kapanışı Nedir?</h4>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4 leading-relaxed">
            <li>Seçilen ayın son gününe kadar (dahil) verilmiş kurumsal siparişlerin tamamını <strong>ÖDENDİ (PAID)</strong> olarak kilitler.</li>
            <li>Borcu olan tüm şirketlerin cari bakiyelerini <strong>0 TL</strong> olarak sıfırlar.</li>
            <li>Süreç takibi için ilgili şirket yöneticilerinin hesaplarına 0 TL tutarında <strong>"✅ Ay Kapanışı (Admin)"</strong> log kaydı bırakır.</li>
            <li><em>Not: Bu işlem manuel eklenen borç veya ödeme kayıtlarına (MANUAL_DEBT/PAYMENT) dokunmaz.</em></li>
          </ul>
        </div>
      </div>

      {/* Selection Panel */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          
          {/* Month Selection */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">DÖNEM AYI</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none appearance-none"
            >
              {MONTHS.map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Selection */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">DÖNEM YILI</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none appearance-none"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={handleFetchPreview}
              disabled={loadingPreview || executingClose}
              className="w-full bg-accent text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-accent/20 flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {loadingPreview ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              <span>Önizleme Oluştur</span>
            </button>
          </div>

        </div>
      </section>

      {/* Success Notification */}
      {successResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-8 rounded-3xl shadow-sm space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="text-emerald-500" size={32} />
            <h3 className="text-xl font-black text-emerald-950">Ay Kapanışı Başarıyla Tamamlandı!</h3>
          </div>
          <p className="text-sm font-semibold text-emerald-800">
            <strong>{successResult.monthName}</strong> dönemine ait tüm hesaplar başarıyla kilitlendi ve bakiyeler sıfırlandı.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white/60 rounded-2xl p-4 border border-emerald-100">
              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider block">Kapatılan Sipariş</span>
              <span className="text-2xl font-black text-emerald-950">{successResult.affectedOrders} adet</span>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 border border-emerald-100">
              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider block">Etkilenen Şirket</span>
              <span className="text-2xl font-black text-emerald-950">{successResult.affectedFirms} firma</span>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 border border-emerald-100">
              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider block">Sıfırlanan Toplam Cari Borç</span>
              <span className="text-2xl font-black text-emerald-950">₺{successResult.totalAmount.toLocaleString('tr-TR')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {previewData && (
        <section className="space-y-6 animate-in fade-in duration-300">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center space-x-4">
              <div className="bg-orange-50 p-4 rounded-2xl text-orange-500">
                <FileText size={28} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">KAPATILACAK SİPARİŞLER</span>
                <span className="text-2xl font-black text-slate-800">{previewData.affectedOrders} adet</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center space-x-4">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-500">
                <Building2 size={28} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">ETKİLENECEK FİRMALAR</span>
                <span className="text-2xl font-black text-slate-800">{previewData.affectedFirms} firma</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center space-x-4">
              <div className="bg-red-50 p-4 rounded-2xl text-red-500">
                <Receipt size={28} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">SIFIRLANACAK CARİ BORÇ</span>
                <span className="text-2xl font-black text-red-600">₺{previewData.totalAmount.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </div>

          {/* List of Companies */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Etkilenecek Firmalar Listesi</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {previewData.companiesList.length > 0 ? (
                previewData.companiesList.map((c, idx) => (
                  <div key={idx} className="p-4 px-6 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                    <span className="font-bold text-slate-700">{c.company_name}</span>
                    <span className="font-black text-red-500">₺{c.balance.toLocaleString('tr-TR')}</span>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 font-semibold italic text-xs">
                  Borç bakiyesi olan kurumsal firma bulunmamaktadır.
                </div>
              )}
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest px-12 py-5 rounded-2xl shadow-xl shadow-red-100 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <AlertOctagon size={18} />
              <span>AY KAPANİŞİNİ BAŞLAT VE SIFIRLA</span>
            </button>
          </div>

        </section>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 space-y-6">
              
              <div className="flex items-center space-x-4 text-red-600">
                <div className="bg-red-50 p-3 rounded-2xl">
                  <AlertOctagon size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">KRİTİK ONAY GEREKLİ</h3>
                  <p className="text-xs text-red-500 font-bold uppercase tracking-wider mt-0.5">Geri Dönülemez İşlem</p>
                </div>
              </div>

              <div className="text-slate-600 text-sm leading-relaxed space-y-3">
                <p>
                  <strong>{MONTHS[selectedMonth - 1]} {selectedYear}</strong> dönemi için toplu hesap kapatma işlemi başlatılacaktır. 
                </p>
                <p>
                  Bu işlem sonucunda seçilen dönemdeki tüm kurumsal siparişler kilitlenecek ve şirket bakiyeleri <strong>0 TL</strong> olarak güncellenecektir. <strong>Bu işlem geri alınamaz!</strong>
                </p>
                <p className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold text-slate-500">
                  İşlemi onaylamak için aşağıdaki kutucuğa büyük harflerle <strong>KAPAT</strong> yazın.
                </p>
              </div>

              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="KAPAT"
                  value={confirmTextInput}
                  onChange={(e) => setConfirmTextInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-center text-lg font-black focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none placeholder-slate-300 uppercase"
                />

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleExecuteClose}
                    disabled={confirmTextInput !== "KAPAT"}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    İŞLEMİ ONAYLA
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setConfirmTextInput("");
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
