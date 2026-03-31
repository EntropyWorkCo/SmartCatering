import { useState } from "react";
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  CreditCard,
  Save,
  LogOut,
  Mail,
  Globe
} from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert("Ayarlar kaydedildi.");
    }, 1000);
  };

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
                    <input type="text" defaultValue="Smart Catering Admin" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">E-Posta</label>
                    <input type="email" defaultValue="admin@smartcatering.com" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none" />
                  </div>
               </div>
               <button className="text-accent text-xs font-black underline hover:text-accent/80 transition-colors">Şifre Değiştir</button>
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
                     <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                        <CreditCard size={18} />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-800">Borç Takibi Modu</p>
                        <p className="text-[10px] text-slate-500">Müşterilerin veresiye almasına izin ver</p>
                     </div>
                  </div>
                  <div className="w-12 h-6 bg-accent rounded-full relative cursor-pointer shadow-inner">
                     <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all"></div>
                  </div>
               </div>

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
                  <div className="w-12 h-6 bg-accent rounded-full relative cursor-pointer shadow-inner">
                     <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all"></div>
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
           {/* Info Card */}
           <div className="bg-[#0F172A] rounded-3xl p-8 shadow-xl relative overflow-hidden border border-white/5">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl"></div>
              <SettingsIcon className="text-accent mb-6" size={32} />
              <h4 className="text-white font-black text-xl italic mb-4">Destek Hattı</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                 Panel ile ilgili bir sorun yaşıyorsanız veya yeni bir özellik eklenmesini istiyorsanız teknik ekiple iletişime geçin.
              </p>
              <div className="space-y-3">
                 <div className="flex items-center space-x-3 text-slate-300">
                    <Mail size={16} className="text-accent" />
                    <span className="text-xs font-bold">destek@smartcatering.com</span>
                 </div>
                 <div className="flex items-center space-x-3 text-slate-300">
                    <Globe size={16} className="text-accent" />
                    <span className="text-xs font-bold">smartcatering.com/admin-help</span>
                 </div>
              </div>
           </div>

           <button className="w-full bg-red-50 text-red-600 p-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-2 border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-100">
              <LogOut size={18} />
              <span>GÜVENLİ ÇIKIŞ YAP</span>
           </button>
        </div>
      </div>
    </div>
  );
}
