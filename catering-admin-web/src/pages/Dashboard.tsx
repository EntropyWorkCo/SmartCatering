import { useEffect, useState, useRef } from "react";
import { 
  Users, 
  TrendingUp, 
  ShoppingBag, 
  UtensilsCrossed, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Loader2,
  BarChart3,
  ArrowRightCircle,
  BellRing,
  Package,
  ChevronRight
} from "lucide-react";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { adisyonService } from "../lib/services/adisyonService";
import { supabase } from "../lib/supabase";

import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: "Bugünkü Sipariş", value: "0", trend: "...", isUp: true, icon: ShoppingBag, color: "blue", path: "/orders" },
    { label: "Bekleyen İşlemler", value: "0", trend: "...", isUp: false, icon: UtensilsCrossed, color: "orange", path: "/orders" },
    { label: "Günlük Ciro", value: "₺0", trend: "...", isUp: true, icon: TrendingUp, color: "emerald", path: "/reports" },
    { label: "Kayıtlı Şirket", value: "0", trend: "...", isUp: true, icon: Users, color: "purple", path: "/customers" },
  ]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [popularItems, setPopularItems] = useState<any[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const cleanup = setupRealtimeSubscription();
    
    // Request notification permission safely
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // Preload notification sound safely
    try {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    } catch (e) {
      console.warn("Audio initialization failed:", e);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'adisyon'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            // Filter: Only delivery orders (PAKET / Sipariş Ver)
            if (["PAKET", "Sipariş Ver"].includes(newOrder.order_type)) {
              handleNewOrder(newOrder);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Refresh data when an order is updated (e.g., status changed to completed)
            fetchDashboardData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNewOrder = async (_order: any) => {
    // Refresh the list to get user/company info
    fetchDashboardData();
    
    // Play sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play error:", e));
    }

    // Show visual alert
    setNewOrderAlert(true);
    setTimeout(() => setNewOrderAlert(false), 5000);

    // Show desktop notification safely
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Yeni Paket Sipariş! 🛵", {
        body: `Bir yeni sipariş alındı. Tutarı kontrol etmek için panele göz atın.`,
        icon: "/favicon.ico"
      });
    }
  };

  const fetchDashboardData = async () => {
    try {
      if (!recentOrders.length) setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Fetch Orders
      const allOrders = await adisyonService.getAllOrders();
      const todayOrders = allOrders.filter(o => new Date(o.created_at) >= today);
      
      // 2. Calculate Stats
      const totalOrdersToday = todayOrders.length;
      
      const pendingOrders = allOrders.filter(o => 
        ["PAKET", "Sipariş Ver"].includes(o.order_type) && 
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
          color: "blue",
          path: "/orders"
        },
        { 
          label: "Bekleyen İşlemler", 
          value: pendingOrders.toString(), 
          trend: "Teslimat", 
          isUp: pendingOrders > 0, 
          icon: UtensilsCrossed, 
          color: "orange",
          path: "/orders"
        },
        { 
          label: "Günlük Ciro", 
          value: `₺${dailyRevenue.toLocaleString("tr-TR")}`, 
          trend: "Gerçek", 
          isUp: true, 
          icon: TrendingUp, 
          color: "emerald",
          path: "/reports"
        },
        { 
          label: "Kayıtlı Şirket", 
          value: (companyCount || 0).toString(), 
          trend: "Genel", 
          isUp: true, 
          icon: Users, 
          color: "purple",
          path: "/customers"
        },
      ]);

      // 4. Process Popular Items
      const itemCounts: { [key: string]: number } = {};
      allOrders.filter(o => !["CANCELLED", "İptal"].includes(o.status)).forEach(order => {
        const itemName = order.itemName || "Karışık Menü"; 
        itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
      });

      const sortedItems = Object.entries(itemCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setPopularItems(sortedItems);

      // Top 5 Recent Orders (Strict Filter for Delivery)
      setRecentOrders(allOrders.filter(o => {
        const isLiveOrder = ["PAKET", "Sipariş Ver"].includes(o.order_type);
        const status = (o.status || "").toUpperCase();
        const isFinalized = ["COMPLETED", "TAMAMLANDI", "CANCELLED", "İPTAL", "PAID", "ÖDENDİ"].includes(status);
        return isLiveOrder && !isFinalized;
      }).slice(0, 5));
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Genel Bakış</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">İşletmenizin anlık durumunu buradan takip edin.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center space-x-2"
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
            <div 
              key={idx} 
              onClick={() => navigate((stat as any).path)}
              className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-accent/10 text-accent group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={24} />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider ${stat.isUp ? "text-emerald-600" : "text-orange-600"} bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg`}>
                  <span>{stat.trend}</span>
                  {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Order Monitor Hub (Full Width) */}
      <div className={`bg-white dark:bg-slate-900 p-8 rounded-[40px] border-2 transition-all duration-500 relative overflow-hidden ${newOrderAlert ? "border-accent scale-[1.01] shadow-2xl shadow-accent/10" : "border-slate-100 dark:border-slate-800 shadow-sm"}`}>
        {newOrderAlert && <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />}
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-6">
              <div className={`p-3 rounded-2xl ${newOrderAlert ? "bg-accent text-white" : "bg-accent/10 text-accent"}`}>
                <BellRing size={28} className={newOrderAlert ? "animate-bounce" : ""} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Canlı Paket Sipariş Takibi
                  {newOrderAlert && <span className="text-xs bg-accent text-white px-3 py-1 rounded-full animate-in zoom-in">YENİ!</span>}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium italic">Sadece paket ve adresten siparişler burada görünür.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentOrders.length === 0 ? (
                <div className="col-span-full py-10 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                   <Package size={40} className="text-slate-200 dark:text-slate-700 mb-2" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Bekleyen paket siparişi yok</p>
                </div>
              ) : (
                recentOrders.map((order, idx) => (
                  <div key={idx} className={`p-5 rounded-3xl border ${idx === 0 && newOrderAlert ? "bg-accent/5 border-accent" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"} flex items-center justify-between group transition-all hover:shadow-lg`}>
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center font-black text-slate-400">
                        {order?.userName?.[0] || "?"}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white uppercase text-sm mb-0.5">{order?.userName || "Bilinmiyor"}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{order.companyName || "Bireysel"} • {order.order_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-slate-900 dark:text-white">₺{order.total_amount}</p>
                       <span className="text-[9px] font-black uppercase text-accent">{order.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Large Navigation Arrow */}
          <div className="flex flex-col items-center lg:items-end justify-center">
             <a 
              href="/orders" 
              className="flex flex-col items-center group bg-accent dark:bg-accent p-10 lg:p-14 rounded-[50px] shadow-2xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
             >
                <ArrowRightCircle size={80} className="text-white group-hover:rotate-[-45deg] transition-transform duration-500" />
                <span className="text-white font-black uppercase tracking-widest mt-4 text-xs whitespace-nowrap">TÜM SİPARİŞLERE GİT</span>
                <ChevronRight className="text-white/50 group-hover:translate-x-2 transition-transform" />
             </a>
          </div>
        </div>
      </div>
      
      {/* Popular Items (Full Width) */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <BarChart3 size={20} className="text-blue-500" />
              <span>En Popüler Yemekler</span>
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Sık Tercih Edilen 5 Ürün</p>
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={popularItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" opacity={0.1} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }}
                width={120}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(116, 207, 98, 0.05)' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--color-surface)' }}
              />
              <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={24}>
                {popularItems.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#74CF62' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
