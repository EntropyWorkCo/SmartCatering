import { useEffect, useState, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Star, 
  Download, 
  MessageSquare, 
  ArrowLeft,
  Loader2,
  User,
  Building2,
  UtensilsCrossed,
  Wallet,
  PlusCircle,
  CheckCircle2,
  X,
  Search,
  Clock
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { adisyonService } from "../lib/services/adisyonService";
import { pdfService } from "../lib/services/pdfService";
import { billingService } from "../lib/services/billingService";
import * as XLSX from "xlsx";

type ReportView = "MAIN" | "SALES" | "FEEDBACK" | "PERFORMANCE" | "DEBTS";

const parseFeedback = (f: any) => {
  let parsedNote = f.note || f.comment || '';
  let parsedDetails = f.rating_details;

  if (f.note && typeof f.note === 'string' && f.note.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(f.note);
      if (parsed && typeof parsed.text !== 'undefined') {
        parsedNote = parsed.text;
        parsedDetails = parsed.details ?? f.rating_details;
      }
    } catch (_) {}
  }

  const user = Array.isArray(f.users) ? f.users[0] : f.users;
  const company =
    user?.["companies!users_company_id_fkey"]?.[0] ??
    user?.["companies!users_company_id_fkey"] ??
    user?.companies?.[0] ??
    user?.companies;

  return {
    id: f.id,
    userName: user?.full_name || 'Müşteri',
    companyName: company?.company_name || 'Bireysel',
    rating: f.rating || 0,
    note: parsedNote,
    rating_details: parsedDetails,
    created_at: f.created_at,
  };
};

export default function Reports() {
  const [view, setView] = useState<ReportView>("MAIN");
  const [orders, setOrders] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const ordersData = await adisyonService.getAllOrders();
      setOrders(ordersData);

      const { data: fbData } = await supabase
        .from("feedbacks")
        .select("*, users(full_name, companies!users_company_id_fkey(company_name))")
        .order("created_at", { ascending: false });
      
      if (fbData) {
        setFeedbacks(fbData.map(parseFeedback));
      }
    } catch (error) {
      console.error("Report data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="font-bold uppercase tracking-widest text-xs">Raporlar Hazırlanıyor...</p>
    </div>
  );

  if (view === "SALES") return <SalesView onBack={() => setView("MAIN")} orders={orders} />;
  if (view === "FEEDBACK") return <FeedbackView onBack={() => setView("MAIN")} feedbacks={feedbacks} />;
  if (view === "PERFORMANCE") return <PerformanceView onBack={() => setView("MAIN")} feedbacks={feedbacks} />;
  if (view === "DEBTS") return <DebtsView onBack={() => setView("MAIN")} setOrders={setOrders} />;

  const avgRating = feedbacks.filter(f => f.rating > 0).length > 0
    ? (feedbacks.filter(f => f.rating > 0).reduce((acc, f) => acc + f.rating, 0) / feedbacks.filter(f => f.rating > 0).length).toFixed(1)
    : "5.0";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Özetler ve Borçlar</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">İşletmenizin performansını ve müşteri borçlarını takip edin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportCard 
          icon={<TrendingUp className="text-emerald-500" size={32} />}
          title="Satış Özetleri"
          description="Ciro, öğün sayıları ve şirket bazlı tüketim raporları."
          onClick={() => setView("SALES")}
        />
        <ReportCard 
          icon={<MessageSquare className="text-indigo-500" size={32} />}
          title="Müşteri Yorumları"
          description={`Ortalama: ${avgRating} ⭐ | ${feedbacks.length} Yorum`}
          onClick={() => setView("FEEDBACK")}
        />
        <ReportCard 
          icon={<BarChart3 className="text-orange-500" size={32} />}
          title="Performans Analizi"
          description="Genel puan ortalaması ve müşteri değerlendirmeleri."
          onClick={() => setView("PERFORMANCE")}
        />
        <ReportCard 
          icon={<Wallet className="text-rose-500" size={32} />}
          title="Borç Yönetimi"
          description="Şirket ve bireysel borç takibi, tahsilat işlemleri."
          onClick={() => setView("DEBTS")}
        />
      </div>
    </div>
  );
}

function ReportCard({ icon, title, description, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col group"
    >
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl w-fit group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">{description}</p>
    </button>
  );
}

const getStatusLabel = (status: string) => {
  const s = (status || "").toUpperCase();
  switch (s) {
    case 'PENDING': return 'BEKLİYOR';
    case 'PREPARING':
    case 'HAZIRLANIYOR': return 'HAZIRLANIYOR';
    case 'READY': return 'YOLDA';
    case 'COMPLETED':
    case 'TAMAMLANDI': return 'TAMAMLANDI';
    case 'PAID':
    case 'ÖDENDİ': return 'ÖDENDİ';
    case 'CANCELLED':
    case 'İPTAL': return 'İPTAL EDİLDİ';
    default: return s;
  }
};

// --- Sales View ---
function SalesView({ onBack, orders }: any) {
  const [period, setPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  
  const stats = useMemo(() => {
    const now = new Date();
    const validOrders = orders.filter((o: any) => {
      const status = String(o.status || '').toUpperCase();
      const type = String(o.order_type || '').toUpperCase();
      const note = String(o.note || '').toUpperCase();

      if (['CANCELLED', 'İPTAL', 'İPTAL EDİLDİ'].includes(status)) return false;
      
      // Ödeme veya Payment geçen hiçbir şeyi ciroya dahil etme
      if (type.includes('PAYMENT') || type.includes('ÖDEME') || note.includes('ÖDEME')) return false;

      const orderDate = new Date(o.created_at);
      const now = new Date();
      
      if (period === "DAILY") return orderDate.toDateString() === now.toDateString();
      if (period === "WEEKLY") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      }
      if (period === "MONTHLY") {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      
      return true;
    });

    const revenue = validOrders.reduce((acc: number, o: any) => acc + (o.total_amount || 0), 0);
    
    const count = validOrders
      .filter((o: any) => o.order_type !== 'MANUAL_DEBT' && o.order_type !== 'MANUAL_PAYMENT')
      .reduce((acc: number, o: any) =>
        acc + (o.adisyon_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0), 0);
    return { revenue, count, filteredOrders: validOrders };
  }, [orders, period]);

  const periodLabel = period === "DAILY" ? "GÜNLÜK" : period === "WEEKLY" ? "HAFTALIK" : "AYLIK";

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors w-fit">
          <ArrowLeft size={20} className="mr-2" /> Geri Dön
        </button>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                period === p ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {p === "DAILY" ? "GÜNLÜK" : p === "WEEKLY" ? "HAFTALIK" : "AYLIK"}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => pdfService.generateSalesReport(stats.filteredOrders, periodLabel)}
            className="flex items-center px-5 py-3 bg-red-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-red-200 hover:scale-105 transition-all"
          >
            <Download size={16} className="mr-2" /> PDF İNDİR
          </button>

          <button 
            onClick={() => {
              const ws_data = [
                ["Tarih", "Müşteri", "Kurum", "Tutar", "Durum"],
                ...stats.filteredOrders.map((o: any) => [
                  new Date(o.created_at).toLocaleDateString('tr-TR'),
                  o.userName,
                  o.companyName || "Bireysel",
                  o.total_amount,
                  getStatusLabel(o.status),
                ])
              ];
              const ws = XLSX.utils.aoa_to_sheet(ws_data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Satış Raporu");
              XLSX.writeFile(wb, `satis_raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
            }}
            className="flex items-center px-5 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-200 hover:scale-105 transition-all"
          >
            <Download size={16} className="mr-2" /> EXCEL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">DÖNEM CİROSU ({periodLabel})</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">₺{stats.revenue.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ÖĞÜN SAYISI</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.count} <span className="text-lg text-slate-400">Adet</span></p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-8">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6">İşlem Özeti</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-800">
                <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarih</th>
                <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Müşteri</th>
                <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tür</th>
                <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutar</th>
                <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {stats.filteredOrders.slice(0, 20).map((o: any) => (
                <tr key={o.id}>
                  <td className="py-3 text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                  <td className="py-3 text-xs font-black text-slate-900 dark:text-white uppercase">{o.userName}</td>
                  <td className="py-3 text-xs font-bold">
                    {o.order_type === 'MANUAL_DEBT' ? <span className="text-orange-500">BORÇ GİRİŞİ</span> : 
                     o.order_type === 'MANUAL_PAYMENT' ? <span className="text-emerald-500">ÖDEME</span> : 
                     <span className="text-blue-500">SİPARİŞ</span>}
                  </td>
                  <td className="py-3 text-right text-xs font-black text-slate-900 dark:text-white">₺{o.total_amount?.toLocaleString('tr-TR')}</td>
                  <td className="py-3 text-right text-[10px] font-black text-accent uppercase tracking-wider">{getStatusLabel(o.status)}</td>
                </tr>
              ))}
              {stats.filteredOrders.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm font-bold">Bu dönemde satış bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Feedback View ---
function FeedbackView({ feedbacks, onBack }: any) {
  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Geri Dön
        </button>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{feedbacks.length} Yorum</span>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-700">
          <Star size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest italic">Henüz yorum yapılmamış.</p>
        </div>
      ) : feedbacks.map((fb: any) => (
        <div key={fb.id} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <User size={18} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{fb.userName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Building2 size={10} className="text-slate-400" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{fb.companyName}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(star => (
                  <Star key={star} size={14} className={star <= fb.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-700"} />
                ))}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(fb.created_at).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>

          {/* Yorum Metni */}
          {fb.note ? (
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed italic mb-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
              "{fb.note}"
            </p>
          ) : null}

          {/* Yemek Puanları */}
          {fb.rating_details && Array.isArray(fb.rating_details) && fb.rating_details.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <UtensilsCrossed size={10} />
                Yemek Puanları
              </p>
              <div className="space-y-2">
                {fb.rating_details.map((detail: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{detail.name}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} size={11} className={star <= detail.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-700"} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Performance View --- (Mobil PerformanceDashboard ile aynı mantık)
function PerformanceView({ feedbacks, onBack }: any) {
  const validRatings = feedbacks.filter((f: any) => f.rating > 0);
  const avgScore = validRatings.length > 0
    ? (validRatings.reduce((acc: number, f: any) => acc + f.rating, 0) / validRatings.length).toFixed(1)
    : "0.0";

  const starCount = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: validRatings.filter((f: any) => Math.round(f.rating) === star).length,
    pct: validRatings.length > 0 ? (validRatings.filter((f: any) => Math.round(f.rating) === star).length / validRatings.length) * 100 : 0,
  }));

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Geri Dön
      </button>

      {/* Hero Puan Kartı */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border-2 border-accent p-8 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">GENEL PUAN ORTALAMASI</p>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-6xl font-black text-accent">{avgScore}</span>
          <span className="text-xl text-slate-400 font-bold">/ 5.0</span>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {[1,2,3,4,5].map(i => (
            <Star key={i} size={24} className={i <= Math.round(parseFloat(avgScore)) ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-700"} />
          ))}
          <span className="text-sm text-slate-400 font-bold ml-2">{feedbacks.length} Yorum</span>
        </div>

        {/* Yıldız Dağılımı */}
        <div className="space-y-2">
          {starCount.map(({ star, count, pct }) => (
            <div key={star} className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400 w-4">{star}</span>
              <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-400 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Yorum Listesi */}
      {feedbacks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-700">
          <Star size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Henüz yorum yok</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((f: any) => (
            <div key={f.id} className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{f.userName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{f.companyName}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <Star key={star} size={13} className={star <= f.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-700"} />
                    ))}
                  </div>
                </div>
                {f.note ? (
                  <p className="text-slate-500 dark:text-slate-400 text-xs italic leading-relaxed">&quot;{f.note}&quot;</p>
                ) : null}
                <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-2 text-right">
                  {new Date(f.created_at).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Debts View ---
function DebtsView({ onBack, setOrders }: any) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL");
  const [searchTerm, setSearchTerm] = useState("");
  const [processing, setProcessing] = useState(false);

  // Borç Giriş Modalı
  const [debtModalVisible, setDebtModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [newAmount, setNewAmount] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Parçalı Ödeme Modalı
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  
  // Geçmiş Modalı
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [accountHistory, setAccountHistory] = useState<any[]>([]);


  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const { data: usersData } = await supabase.from('users').select('*');
      const { data: companiesData } = await supabase.from('companies').select('*');
      const ordersData = await adisyonService.getAllOrders();
      
      setOrders(ordersData);

      if (usersData) {
        const formatted = usersData.map((profile: any) => {
          let isOwner = false;
          let userCompany = companiesData?.find((c: any) => c.user_id === profile.id);
          if (userCompany) isOwner = true;
          else userCompany = companiesData?.find((c: any) => c.id === profile.company_id);

          let balance = 0;
          if (isOwner && userCompany) {
            balance = userCompany.balance || 0;
          } else {
            // Hem bireysel hem de kurumsal çalışanlar için adisyondan bakiye hesapla
            const userOrders = ordersData?.filter((o: any) => {
              const status = String(o.status || "").toUpperCase();
              // İptal edilmemiş ve henüz tam ödenmemiş (PAID olmayan) siparişleri/borçları topla
              return o.user_id === profile.id && !["CANCELLED", "İPTAL", "PAID", "ÖDENDI", "ÖDENDİ"].includes(status);
            }) || [];
            
            balance = userOrders.reduce((sum: number, order: any) => {
              if (order.order_type === 'MANUAL_PAYMENT') {
                return sum - (order.total_amount || 0);
              }
              return sum + (order.total_amount || 0);
            }, 0);
            balance = Math.max(0, balance);
          }

          return {
            id: profile.id,
            name: profile.full_name || 'İsimsiz Müşteri',
            phone: profile.phone || '',
            companyName: userCompany?.company_name || 'Bireysel',
            companyId: userCompany?.id,
            balance: balance,
            isOwner: isOwner,
            isCorporate: !!userCompany,
            companyBalance: userCompany?.balance || 0
          };
        });
        setCustomers(formatted);
      }
    } catch (err) {
      console.error("Borç verisi çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const corporateGroups = (() => {
    const groups: Record<string, any> = {};
    filtered.filter(c => c.isCorporate).forEach(c => {
      if (!groups[c.companyId]) {
        groups[c.companyId] = {
          companyId: c.companyId,
          companyName: c.companyName,
          totalDebt: Math.max(0, c.companyBalance),
          ownerId: c.isOwner ? c.id : null,
          users: []
        };
      }
      if (c.isOwner) {
        groups[c.companyId].ownerId = c.id;
      }
      groups[c.companyId].users.push(c);
    });
    return Object.values(groups).sort((a, b) => b.totalDebt - a.totalDebt);
  })();

  const individualList = filtered.filter(c => !c.isCorporate).sort((a, b) => b.balance - a.balance);

  const handleUpdateDebt = async () => {
    if (!selectedAccount || !newAmount) return;
    try {
      setProcessing(true);
      const amount = Number(newAmount);
      const userId = selectedAccount.ownerId || selectedAccount.id;

      await billingService.addManualEntry(userId, amount, startDate, endDate, 'DEBT');
      
      if (selectedAccount.companyId) {
        await billingService.updateCompanyBalance(selectedAccount.companyId, selectedAccount.totalDebt + amount);
      }
      
      alert("Borç başarıyla eklendi.");
      setDebtModalVisible(false);
      setNewAmount("");
      fetchDebts();
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleShowHistory = async (account: any) => {
    try {
      setSelectedAccount(account);
      const userId = account.ownerId || account.id;
      // İlgili kullanıcının tüm adisyonlarını (borç/ödeme/sipariş) çek
      const { data, error } = await supabase
        .from('adisyon')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAccountHistory(data || []);
      setHistoryModalVisible(true);
    } catch (err: any) {
      alert("Geçmiş çekilemedi: " + err.message);
    }
  };

  const handlePayment = async () => {
    if (!selectedAccount || !newAmount) return;
    try {
      setProcessing(true);
      const amount = Number(newAmount);
      const userId = selectedAccount.ownerId || selectedAccount.id;

      await billingService.recordPayment(
        userId,
        selectedAccount.companyId || null,
        amount,
        "",
        "Parçalı Ödeme (Panel)"
      );

      alert("Ödeme başarıyla kaydedildi.");
      setPaymentModalVisible(false);
      setNewAmount("");
      fetchDebts();
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearAll = async (account: any) => {
    if (!window.confirm(`${account.companyName || account.name} için tüm borcu sıfırlamak istiyor musunuz?`)) return;
    try {
      setProcessing(true);
      const userId = account.ownerId || account.id;
      if (account.companyId) {
        await billingService.clearCompanyBalance(account.companyId);
      } else {
        await adisyonService.clearUserDebt(userId);
      }
      alert("Borç sıfırlandı.");
      fetchDebts();
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadEkstre = async (account: any) => {
     try {
       setProcessing(true);
       const orders = await adisyonService.getCompanyOrders(account.companyId || account.id);
       const accountData = {
         displayName: account.companyName || account.name,
         isCorporate: !!account.companyId,
         manualDebt: account.totalDebt || account.balance,
         total: account.balance || 0
       };
       pdfService.generateCompanyExtre(accountData, orders);
     } catch (err: any) {
       alert("Hata: " + err.message);
     } finally {
       setProcessing(false);
     }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-in fade-in duration-500">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Borç Verileri Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors w-fit">
          <ArrowLeft size={20} className="mr-2" /> Geri Dön
        </button>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setMainTab("KURUMSAL")}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${mainTab === 'KURUMSAL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
          >
            KURUMSAL
          </button>
          <button 
            onClick={() => setMainTab("BIREYSEL")}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${mainTab === 'BIREYSEL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
          >
            BİREYSEL
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Firma veya müşteri ara..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Görünüm:</span>
             <span className="text-xs font-black text-slate-900 dark:text-white">{mainTab}</span>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5 text-left">Müşteri / Firma</th>
                <th className="px-8 py-5 text-right">Güncel Borç</th>
                <th className="px-8 py-5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {mainTab === "KURUMSAL" ? corporateGroups.map(group => (
                <tr key={group.companyId} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{group.companyName}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{group.users.length} Kayıtlı Kişi</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className={`text-lg font-black ${group.totalDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      ₺{group.totalDebt.toLocaleString('tr-TR')}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => handleShowHistory(group)}
                        className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-slate-100 shadow-sm"
                      >
                        <Clock size={14} />
                        <span>GEÇMİŞ</span>
                      </button>
                      <button 
                        onClick={() => { setSelectedAccount(group); setDebtModalVisible(true); }}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-blue-100 shadow-sm"
                      >
                        <PlusCircle size={14} />
                        <span>BORÇ GİR</span>
                      </button>
                      <button 
                        onClick={() => { setSelectedAccount(group); setPaymentModalVisible(true); }}
                        className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-500 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-orange-100 shadow-sm"
                      >
                        <Wallet size={14} />
                        <span>ÖDEME AL</span>
                      </button>
                      <button 
                        onClick={() => handleDownloadEkstre(group)}
                        className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-slate-200 shadow-sm"
                      >
                        <Download size={14} />
                        <span>DÖKÜM</span>
                      </button>
                      <button 
                        onClick={() => handleClearAll(group)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-emerald-100 shadow-sm"
                      >
                        <CheckCircle2 size={14} />
                        <span>SIFIRLA</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : individualList.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{c.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className={`text-lg font-black ${c.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      ₺{c.balance.toLocaleString('tr-TR')}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => handleShowHistory(c)}
                        className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                        title="İşlem Geçmişi"
                      >
                        <Clock size={16} />
                      </button>
                      <button 
                        onClick={() => { setSelectedAccount(c); setPaymentModalVisible(true); }}
                        className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-500 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-orange-100 shadow-sm"
                      >
                        <Wallet size={14} />
                        <span>ÖDEME AL</span>
                      </button>
                      <button 
                        onClick={() => handleClearAll(c)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-2 border border-emerald-100 shadow-sm"
                      >
                        <CheckCircle2 size={14} />
                        <span>SIFIRLA</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Borç Ekle Modalı */}
      {debtModalVisible && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white">Borç Girişi</h2>
                 <button onClick={() => setDebtModalVisible(false)}><X size={24} className="text-slate-400" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tutar (₺)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-2xl font-black focus:ring-2 focus:ring-accent"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Başlangıç</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bitiş</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold" />
                    </div>
                 </div>
                 <button 
                  onClick={handleUpdateDebt}
                  disabled={processing}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                 >
                   {processing ? <Loader2 className="animate-spin mx-auto" /> : "BORCU KAYDET"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Ödeme Al Modalı (Kısmi Ödeme) */}
      {paymentModalVisible && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white">Ödeme Al</h2>
                 <button onClick={() => setPaymentModalVisible(false)}><X size={24} className="text-slate-400" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ödeme Tutarı (₺)</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-2xl font-black focus:ring-2 focus:ring-accent"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00"
                    />
                 </div>

                 <button 
                  onClick={handlePayment}
                  disabled={processing}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 hover:scale-[1.02] transition-all disabled:opacity-50"
                 >
                   {processing ? <Loader2 className="animate-spin mx-auto" /> : "ÖDEMEYİ KAYDET"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Geçmiş Modalı */}
      {historyModalVisible && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase">{selectedAccount?.companyName || selectedAccount?.name}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İŞLEM GEÇMİŞİ (EKSTRE)</p>
              </div>
              <button onClick={() => setHistoryModalVisible(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-8">
              {accountHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Henüz işlem kaydı bulunamadı.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left pb-4">Tarih</th>
                      <th className="text-left pb-4">İşlem</th>
                      <th className="text-right pb-4">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {accountHistory.map((h: any) => (
                      <tr key={h.id}>
                        <td className="py-4 text-xs font-bold text-slate-500">
                          {new Date(h.created_at).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="py-4">
                          <div className="text-xs font-black text-slate-900 dark:text-white uppercase">
                            {h.order_type === 'MANUAL_DEBT' ? 'BORÇ GİRİŞİ' : 
                             h.order_type === 'MANUAL_PAYMENT' ? 'ÖDEME YAPILDI' : 
                             'YEMEK SİPARİŞİ'}
                          </div>
                          {h.note && <div className="text-[9px] text-slate-400 font-bold">{h.note}</div>}
                        </td>
                        <td className={`py-4 text-right text-xs font-black ${h.order_type === 'MANUAL_PAYMENT' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {h.order_type === 'MANUAL_PAYMENT' ? '-' : ''}₺{h.total_amount?.toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest">GÜNCEL BAKİYE:</span>
               <span className="text-2xl font-black text-accent">₺{selectedAccount?.balance?.toLocaleString('tr-TR')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
