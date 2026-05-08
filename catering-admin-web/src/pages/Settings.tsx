import { useState, useEffect } from "react";
import { 
  User, 
  Shield, 
  Bell, 
  Save,
  LogOut,
  Loader2
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { userService } from "../lib/services/userService";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: ""
  });

  const [config, setConfig] = useState({
    debtMode: localStorage.getItem("debtMode") !== "false",
    notifications: localStorage.getItem("notifications") !== "false"
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const userProfile = await userService.getProfile(user.id);
      setProfile({
        fullName: userProfile.full_name || "",
        email: user.email || "",
        phone: userProfile.phone || ""
      });
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await userService.updateProfile(user.id, {
        fullName: profile.fullName,
        phone: profile.phone
      });

      // Save config to local storage (Mocking global settings)
      localStorage.setItem("debtMode", String(config.debtMode));
      localStorage.setItem("notifications", String(config.notifications));

      alert("Ayarlar başarıyla güncellendi.");
    } catch (err) {
      console.error("Save error:", err);
      alert("Ayarlar kaydedilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      await supabase.auth.signOut();
      navigate("/login");
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold uppercase tracking-widest text-xs tracking-[0.2em]">Ayarlar Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ayarlar</h1>
        <p className="text-slate-500 mt-1">Uygulama genelini ve profilinizi buradan yapılandırın.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {/* Admin Profile */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-8 border-accent">
            <div className="p-6 border-b border-slate-50 flex items-center space-x-3">
               <User className="text-slate-400" size={20} />
               <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Admin Profili</h3>
            </div>
            <div className="p-8 space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Tam İsim</label>
                    <input 
                      type="text" 
                      value={profile.fullName} 
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">E-Posta (Salt Okunur)</label>
                    <input 
                      type="email" 
                      value={profile.email} 
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold opacity-70 cursor-not-allowed" 
                    />
                  </div>
               </div>
               <button 
                  onClick={async () => {
                    const newPassword = window.prompt("Yeni şifrenizi girin (En az 6 karakter):");
                    if (newPassword) {
                      if (newPassword.length < 6) {
                        alert("Şifre en az 6 karakter olmalıdır.");
                        return;
                      }
                      try {
                        const { error } = await supabase.auth.updateUser({ password: newPassword });
                        if (error) throw error;
                        alert("Şifreniz başarıyla güncellendi.");
                      } catch (err: any) {
                        console.error(err);
                        alert("Şifre güncellenirken hata oluştu: " + err.message);
                      }
                    }
                  }}
                  className="text-accent text-xs font-black underline hover:text-accent/80 transition-colors"
                >
                  Şifre Değiştir
                </button>
            </div>
          </section>

          {/* App Config */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center space-x-3">
               <Shield className="text-slate-400" size={20} />
               <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Uygulama Yapılandırması</h3>
            </div>
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                         <Bell size={18} />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-800">Otomatik Bildirimler</p>
                         <p className="text-[10px] text-slate-500">Sipariş durum değişikliklerinde PUSH gönder</p>
                      </div>
                   </div>
                   <div 
                     onClick={() => setConfig({ ...config, notifications: !config.notifications })}
                     className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 ${config.notifications ? 'bg-accent' : 'bg-slate-300'}`}
                   >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${config.notifications ? 'right-1' : 'left-1'}`}></div>
                   </div>
                </div>
            </div>
          </section>

          <div className="flex justify-end">
             <button 
               onClick={handleSave}
               className="bg-accent text-white px-12 py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/30 flex items-center space-x-3 hover:scale-[1.02] active:scale-95 transition-all"
             >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <Save size={20} />}
                <span>DEGİŞİKLİKLERİ KAYDET</span>
             </button>
          </div>
        </div>

        <div className="space-y-6">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 p-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-2 border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-100"
            >
               <LogOut size={18} />
               <span>GÜVENLİ ÇIKIŞ YAP</span>
            </button>
        </div>
      </div>
    </div>
  );
}
