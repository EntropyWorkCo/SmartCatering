import { useEffect, useState } from "react";
import { 
  Users, 
  TrendingUp, 
  ShoppingBag, 
  UtensilsCrossed, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Loader2
} from "lucide-react";
import { adisyonService } from "../lib/services/adisyonService";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: "Bugünkü Sipariş", value: "0", trend: "...", isUp: true, icon: ShoppingBag, color: "blue" },
    { label: "Bekleyen İşlemler", value: "0", trend: "...", isUp: false, icon: UtensilsCrossed, color: "orange" },
    { label: "Günlük Ciro", value: "₺0", trend: "...", isUp: true, icon: TrendingUp, color: "emerald" },
    { label: "Kayıtlı Şirket", value: "0", trend: "...", isUp: true, icon: Users, color: "purple" },
  ]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Fetch Orders
      const allOrders = await adisyonService.getAllOrders();
      const todayOrders = allOrders.filter(o => new Date(o.created_at) >= today);
      
      // 2. Calculate Stats
      const totalOrdersToday = todayOrders.length;
      
      // Bekleyen İşlemler: Sadece "Teslimat" gereken (Paket, Sipariş Ver) bekleyenler
      const pendingOrders = allOrders.filter(o => 
        o.order_type !== "Şimdi Ye" && 
        ["PENDING", "PREPARING", "HAZIRLANIYOR"].includes(o.status)
      ).length;

      const dailyRevenue = todayOrders
        .filter(o => !["CANCELLED", "İptal"].includes(o.status))
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      // 3. Fetch Company Count
      const { count: companyCount } = await supabase.from("companies").select("*", { count: "exact", head: true });

      setStats([
        { 
          label: "Bugünkü Sipariş", 
          value: totalOrdersToday.toString(), 
          trend: "Toplam", 
          isUp: true, 
          icon: ShoppingBag, 
          color: "blue" 
        },
        { 
          label: "Bekleyen İşlemler", 
          value: pendingOrders.toString(), 
          trend: "Teslimat", 
          isUp: pendingOrders > 0, 
          icon: UtensilsCrossed, 
          color: "orange" 
        },
        { 
          label: "Günlük Ciro", 
          value: `₺${dailyRevenue.toLocaleString("tr-TR")}`, 
          trend: "Gerçek", 
          isUp: true, 
          icon: TrendingUp, 
          color: "emerald" 
        },
        { 
          label: "Kayıtlı Şirket", 
          value: (companyCount || 0).toString(), 
          trend: "Genel", 
          isUp: true, 
          icon: Users, 
          color: "purple" 
        },
      ]);

      // Top 5 Recent Orders: Sadece teslimat odaklı canlı siparişler (Şimdi Ye hariç)
      setRecentOrders(allOrders.filter(o => o.order_type !== "Şimdi Ye").slice(0, 5));
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Genel Bakış</h1>
          <p className="text-slate-500 mt-1 font-medium">İşletmenizin anlık durumunu buradan takip edin.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm flex items-center space-x-2"
        >
          <Clock size={16} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-accent/10 text-accent group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={24} />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider ${stat.isUp ? "text-emerald-600" : "text-orange-600"} bg-slate-50 px-2 py-1 rounded-lg`}>
                  <span>{stat.trend}</span>
                  {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Tables & Activities Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <h2 className="text-lg font-black text-slate-900">Aktif Teslimatlar</h2>
            <a href="/orders" className="text-accent text-sm font-black hover:underline uppercase tracking-wider">Tümünü Gör</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/30 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-6 py-4">Müşteri / Kurum</th>
                  <th className="px-6 py-4">Tutar</th>
                  <th className="px-6 py-4 text-right">Durum</th>
                  <th className="px-6 py-4 text-right">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic text-sm">Aktif teslimat bulunmuyor.</td>
                  </tr>
                ) : recentOrders.map((order, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 uppercase">{order.userName}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{order.companyName || "Bireysel"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 text-sm">₺{order.total_amount?.toLocaleString("tr-TR")}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                        ${order.status === 'READY' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 
                          ['PENDING', 'PREPARING'].includes(order.status) ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                          'bg-emerald-100 text-emerald-700 border border-emerald-200'}
                      `}>
                        {order.status === 'PENDING' ? 'Bekliyor' : order.status === 'PREPARING' ? 'Hazırlanıyor' : order.status === 'READY' ? 'Yolda' : 'Tamamlandı'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-[10px] text-slate-500 font-bold whitespace-nowrap">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Info / Status */}
        <div className="bg-slate-900 rounded-[40px] p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl group-hover:bg-accent/30 transition-all duration-500"></div>
          <h2 className="text-xl font-black text-white mb-6 flex items-center space-x-2">
            <span className="w-1.5 h-6 bg-accent rounded-full"></span>
            <span>Hızlı Durum</span>
          </h2>
          
          <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Canlı Takip Notu</p>
                  <p className="text-xs text-slate-200 leading-relaxed italic">
                    "Şu an sadece <strong>Sipariş Ver</strong> ve <strong>Paket</strong> modundaki teslimat talep eden siparişleri görüyorsunuz. Yemekhaneden alan 'Şimdi Ye' siparişleri Raporlar kısmına kaydedilmektedir."
                  </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10">
                 <a href="/reports" className="flex items-center justify-between text-white group">
                    <span className="text-sm font-black">Tüm Raporları Gör</span>
                    <ArrowUpRight size={20} className="text-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                 </a>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
