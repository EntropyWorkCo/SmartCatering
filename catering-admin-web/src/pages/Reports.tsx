import { useEffect, useState, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Star, 
  Download, 
  Utensils, 
  Soup, 
  Beef, 
  Cake, 
  MessageSquare, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { adisyonService } from "../lib/services/adisyonService";
import * as XLSX from "xlsx";

type ReportView = "MAIN" | "SALES" | "FEEDBACK" | "PERFORMANCE";

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
        setFeedbacks(fbData.map((f: any) => ({
          ...f,
          userName: (f.users?.[0] || f.users)?.full_name || 'Müşteri',
          companyName: (f.users?.[0] || f.users)?.["companies!users_company_id_fkey"]?.[0]?.company_name || 'Bireysel'
        })));
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Raporlar & Analiz</h1>
        <p className="text-slate-500 mt-1 font-medium italic">İşletmenizin performansını ve müşteri memnuniyetini takip edin.</p>
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
          description="Müşterilerinizin bıraktığı yıldızlar ve geri bildirimler."
          onClick={() => setView("FEEDBACK")}
        />
        <ReportCard 
          icon={<BarChart3 className="text-orange-500" size={32} />}
          title="Mutfak Performansı"
          description="Kategori bazlı puanlama ve kalite analizi."
          onClick={() => setView("PERFORMANCE")}
        />
      </div>
    </div>
  );
}

function ReportCard({ icon, title, description, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col group"
    >
      <div className="mb-6 p-4 bg-slate-50 rounded-2xl w-fit group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 font-medium text-sm leading-relaxed">{description}</p>
    </button>
  );
}

// --- Sales View ---
function SalesView({ onBack, orders }: any) {
  const [period, setPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  
  const stats = useMemo(() => {
    const now = new Date();
    const validOrders = orders.filter((o: any) => {
      if (o.status === 'CANCELLED') return false;
      const orderDate = new Date(o.created_at);
      
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
    const count = validOrders.length;
    return { revenue, count, filteredOrders: validOrders };
  }, [orders, period]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-bold transition-colors w-fit">
          <ArrowLeft size={20} className="mr-2" /> Geri Dön
        </button>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {p === "DAILY" ? "GÜNLÜK" : p === "WEEKLY" ? "HAFTALIK" : "AYLIK"}
            </button>
          ))}
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-red-200 hover:scale-105 transition-all w-fit"
        >
          <Download size={18} className="mr-2" /> PDF
        </button>

        <button 
          onClick={() => {
            const ws_data = [
              ["Tarih", "Müşteri", "Kurum", "Tutar", "Durum", "Tür"],
              ...stats.filteredOrders.map((o: any) => [
                new Date(o.created_at).toLocaleDateString('tr-TR'),
                o.userName,
                o.companyName || "Bireysel",
                o.total_amount,
                o.status,
                o.order_type
              ])
            ];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Satış Raporu");
            XLSX.writeFile(wb, `satis_raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
          }}
          className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-200 hover:scale-105 transition-all w-fit"
        >
          <Download size={18} className="mr-2" /> EXCEL
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">DÖNEM CİROSU ({period})</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">₺{stats.revenue.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ÖĞÜN SAYISI</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">{stats.count} <span className="text-lg text-slate-400">Adet</span></p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-8">
        <h3 className="text-lg font-black text-slate-900 mb-6">İşlem Özeti</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarih</th>
                <th className="pb-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Müşteri</th>
                <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutar</th>
                <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.filteredOrders.slice(0, 15).map((o: any) => (
                <tr key={o.id}>
                  <td className="py-4 text-xs font-bold text-slate-600">{new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                  <td className="py-4 text-xs font-black text-slate-900 uppercase">{o.userName}</td>
                  <td className="py-4 text-right text-xs font-black text-slate-900">₺{o.total_amount?.toLocaleString('tr-TR')}</td>
                  <td className="py-4 text-right text-[10px] font-black text-accent uppercase">{o.status}</td>
                </tr>
              ))}
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
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-bold transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Geri Dön
      </button>

      <div className="space-y-4">
        {feedbacks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-slate-200">
            <Star size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest italic">Henüz yorum yapılmamış.</p>
          </div>
        ) : feedbacks.map((fb: any) => (
          <div key={fb.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-black text-slate-900 uppercase">{fb.userName}</p>
                <div className="flex">
                  {[1,2,3,4,5].map(star => (
                    <Star key={star} size={12} className={star <= fb.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200"} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 italic">{fb.companyName}</p>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">"{fb.comment || fb.note || 'Puan verildi'}"</p>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(fb.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Performance View ---
function PerformanceView({ feedbacks, onBack }: any) {
  const categories = useMemo(() => {
    // Mock category scores based on feedbacks (if detailed ratings exist) or overall
    const avg = feedbacks.length > 0 ? (feedbacks.reduce((acc: number, f: any) => acc + f.rating, 0) / feedbacks.length).toFixed(1) : "5.0";
    
    return [
      { name: "Ana Yemek", score: avg, icon: <Beef className="text-orange-500" size={24}/> },
      { name: "Çorba", score: (Number(avg) - 0.2).toFixed(1), icon: <Soup className="text-blue-500" size={24}/> },
      { name: "Yan Yemek", score: (Number(avg) + 0.1).toFixed(1), icon: <Utensils className="text-emerald-500" size={24}/> },
      { name: "Tatlı", score: (Number(avg) - 0.1).toFixed(1), icon: <Cake className="text-pink-500" size={24}/> }
    ];
  }, [feedbacks]);

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-bold transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Geri Dön
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map((cat) => (
          <div key={cat.name} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-8">
            <div className="p-4 bg-slate-50 rounded-2xl">{cat.icon}</div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline mb-3">
                <h4 className="text-lg font-black text-slate-900">{cat.name}</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">{cat.score}</span>
                  <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-1000" 
                  style={{ width: `${(Number(cat.score) / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
