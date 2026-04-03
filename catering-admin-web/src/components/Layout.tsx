import { Outlet, Link, useLocation } from "react-router-dom";
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
  Moon
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Layout() {
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const menuItems = [
    { path: "/", label: "Hızlı Özet", icon: LayoutDashboard },
    { path: "/orders", label: "Sipariş Yönetimi", icon: ShoppingBag },
    { path: "/menu", label: "Menü Yönetimi", icon: UtensilsCrossed },
    { path: "/customers", label: "Müşteriler", icon: Users },
    { path: "/reports", label: "Raporlar", icon: BarChart3 },
    { path: "/messages", label: "Mesajlar", icon: MessageSquare },
    { path: "/settings", label: "Ayarlar", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0F172A] dark:bg-[#020617] text-white flex flex-col shadow-2xl z-20 border-r border-white/5">
        <div className="p-8 pb-12 flex items-center space-x-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
            <UtensilsCrossed className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Smart Catering</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-[0.2em] uppercase">Admin Console</p>
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
          
          <button className="w-full flex items-center space-x-3 py-3 px-4 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-200 group">
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
            <p className="text-primary dark:text-white font-black">Admin Kullanıcı</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all group"
            >
              {isDark ? <Sun size={20} className="text-amber-400 group-rotate-45" /> : <Moon size={20} className="text-indigo-400" />}
            </button>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#0F172A]"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center space-x-3 pl-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold border-2 border-white dark:border-slate-800 shadow-sm">
                A
              </div>
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
