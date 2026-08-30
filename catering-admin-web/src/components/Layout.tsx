import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  LogOut, 
  Settings,
  Bell,
  Users,
  MessageSquare,
  BarChart3, 
  Sun, 
  Moon,
  Clock,
  ChevronRight,
  CalendarRange
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { adisyonService } from "../lib/services/adisyonService";
import { userService } from "../lib/services/userService";
import { supabase } from "../lib/supabase";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [adminName, setAdminName] = useState("Admin Kullanıcı");
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    fetchTodayOrders();
    fetchAdminName();
    const cleanup = setupRealtimeSubscription();

    // Close notifications on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      if (cleanup) cleanup();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchAdminName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await userService.getProfile(user.id);
        if (profile?.full_name) {
          setAdminName(profile.full_name);
        }
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  };

  const fetchTodayOrders = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allOrders = await adisyonService.getAllOrders();
      const todayLiveOrders = allOrders.filter(o => 
        new Date(o.created_at) >= today && 
        ["PAKET", "Sipariş Ver"].includes(o.order_type)
      ).slice(0, 10); // Show last 10
      
      setNotifications(todayLiveOrders);
    } catch (error) {
      console.error("Layout notifications fetch error:", error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adisyon' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            if (["PAKET", "Sipariş Ver"].includes(newOrder.order_type)) {
              setHasNewNotification(true);
              fetchTodayOrders();
            }
          } else if (payload.eventType === 'UPDATE') {
            fetchTodayOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusLabel = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case 'PENDING': return 'BEKLİYOR';
      case 'PREPARING': return 'HAZIRLANIYOR';
      case 'READY': return 'YOLDA';
      case 'COMPLETED': return 'TAMAMLANDI';
      case 'PAID': return 'ÖDENDİ';
      case 'CANCELLED': return 'İPTAL EDİLDİ';
      default: return s;
    }
  };

  const handleLogout = async () => {
    try {
      // 1. Supabase oturumunu kapat
      await supabase.auth.signOut();
      
      // 2. LocalStorage ve SessionStorage'ı temizle
      localStorage.clear();
      sessionStorage.clear();
      
      // 3. Login sayfasına yönlendir
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Çıkış yapılırken hata oluştu:", error);
      // Hata olsa bile kullanıcıyı login'e fırlat (en güvenlisi)
      navigate("/login", { replace: true });
    }
  };

  const getStatusColor = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case 'PENDING': return 'text-orange-500 bg-orange-50 border-orange-100';
      case 'PREPARING': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'READY': return 'text-indigo-500 bg-indigo-50 border-indigo-100';
      case 'COMPLETED':
      case 'PAID': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      case 'CANCELLED': return 'text-red-500 bg-red-50 border-red-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const menuItems = [
    { path: "/", label: "Hızlı Özet", icon: LayoutDashboard },
    { path: "/orders", label: "Sipariş Yönetimi", icon: ShoppingBag },
    { path: "/menu", label: "Menü Yönetimi", icon: UtensilsCrossed },
    { path: "/customers", label: "Müşteriler", icon: Users },
    { path: "/reports", label: "Özetler ve Borçlar", icon: BarChart3 },
    { path: "/messages", label: "Mesajlar", icon: MessageSquare },
    { path: "/month-close", label: "Ay Kapanışı", icon: CalendarRange },
    { path: "/settings", label: "Ayarlar", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0F172A] dark:bg-[#020617] text-white flex flex-col shadow-2xl z-20 border-r border-white/5">
        <div className="p-8 pb-12 flex items-center space-x-3">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg border border-white/5 backdrop-blur-sm">
            <img src="/favicon.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white italic">MEYDAN</h1>
            <p className="text-[10px] text-orange-500 font-black tracking-[0.3em] uppercase">LOKANTA</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`
                  flex items-center space-x-3 py-3 px-4 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? "bg-accent text-white shadow-lg shadow-accent/30 font-semibold" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }
                `}
              >
                <Icon size={18} className={isActive ? "text-white" : "group-hover:scale-110 transition-transform"} />
                <span className="text-[14px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 mt-auto">
          <div className="bg-slate-800/40 rounded-2xl p-4 mb-6 backdrop-blur-sm border border-white/5">
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-xs font-semibold text-slate-300">Sistem Çevrimiçi</p>
            </div>
            <p className="text-[10px] text-slate-500">Son güncelleme: Az önce</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 py-3 px-4 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-200 group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Güvenli Çıkış</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-30 sticky top-0">
          <div>
            <h2 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Hoş Geldiniz,</h2>
            <p className="text-primary dark:text-white font-black">{adminName}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all group"
            >
              {isDark ? <Sun size={20} className="text-amber-400 group-rotate-45" /> : <Moon size={20} className="text-indigo-400" />}
            </button>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setHasNewNotification(false);
                }}
                className={`p-2 rounded-full relative transition-all duration-300 ${
                  showNotifications 
                    ? "bg-accent text-white shadow-lg shadow-accent/20" 
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Bell size={20} className={hasNewNotification ? "animate-swing" : ""} />
                {hasNewNotification && (
                  <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-[380px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300 z-50">
                  <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Canlı Siparişler</h3>
                    <span className="text-[10px] font-black bg-accent text-white px-2 py-0.5 rounded-full">{notifications.length}</span>
                  </div>

                  <div className="max-h-[450px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center">
                        <ShoppingBag size={40} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Henüz sipariş yok</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {notifications.map((order) => (
                          <Link 
                            key={order.id}
                            to="/orders"
                            onClick={() => setShowNotifications(false)}
                            className="p-5 flex items-start space-x-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                          >
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center font-black text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform">
                              {order.userName?.[0] || '?'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">{order.userName}</p>
                                <p className="text-[10px] font-bold text-slate-400">₺{order.total_amount}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-3">
                                {order.companyName || 'Bireysel'} • {order.order_type}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-black border px-2 py-0.5 rounded-lg uppercase tracking-wider ${getStatusColor(order.status)}`}>
                                  {getStatusLabel(order.status)}
                                </span>
                                <div className="flex items-center text-[9px] font-bold text-slate-300 dark:text-slate-600">
                                  <Clock size={10} className="mr-1" />
                                  {new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )
                    }
                  </div>

                  <Link 
                    to="/orders"
                    onClick={() => setShowNotifications(false)}
                    className="p-4 bg-slate-900 dark:bg-accent text-white text-center block text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
                  >
                    Tüm Siparişleri Gör <ChevronRight size={12} className="inline-block ml-1" />
                  </Link>
                </div>
              )}
            </div>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-3 pl-2 group"
              >
                <div className="w-10 h-10 bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold border-2 border-white dark:border-slate-800 shadow-sm group-hover:shadow-md transition-all">
                  A
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-4 w-64 bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white font-black shadow-lg shadow-accent/20">A</div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Admin Kullanıcı</p>
                        <p className="text-[10px] text-slate-400 font-bold">admin@meydan.com</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link 
                      to="/settings"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full flex items-center space-x-3 p-4 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest"
                    >
                      <Settings size={16} />
                      <span>Sistem Ayarları</span>
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold text-xs uppercase tracking-widest"
                    >
                      <LogOut size={16} />
                      <span>Güvenli Çıkış Yap</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC] dark:bg-[#020617]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
