import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Lock, 
  Mail, 
  Loader2, 
  UtensilsCrossed, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { userService } from "../lib/services/userService";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Mobildeki mantığın aynısı: admins tablosundan sorgula
      const { data: admin, error: authError } = await supabase
        .from("admins")
        .select("*")
        .eq("email", email)
        .eq("access_code", password) // 1234 burada access_code olarak kullanılıyor
        .single();

      if (authError || !admin) {
        throw new Error("Geçersiz e-posta veya güvenlik anahtarı.");
      }

      // Başarılı giriş: Bilgileri yerel hafızaya kaydet
      localStorage.setItem("admin_session", JSON.stringify({
        id: admin.id,
        email: admin.email,
        name: admin.name || "Admin Kullanıcı",
        login_at: new Date().toISOString()
      }));

      // Ana sayfaya yönlendir
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden font-inter">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px]"></div>
      
      <div className="w-full max-w-md p-4 animate-in fade-in zoom-in duration-700">
        <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden relative">
          
          {/* Top Branding Section */}
          <div className="bg-[#0F172A] p-10 text-center relative overflow-hidden">
             {/* Gradient Overlay */}
             <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent"></div>
             
             <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-accent/40 mb-6 group hover:rotate-12 transition-transform duration-500">
                   <UtensilsCrossed className="text-white" size={36} />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight italic">Meydan Lokanta</h1>
                <div className="flex items-center space-x-2 mt-2">
                   <div className="h-[1px] w-4 bg-slate-600"></div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">Admin Panel</p>
                   <div className="h-[1px] w-4 bg-slate-600"></div>
                </div>
             </div>
          </div>

          {/* Form Section */}
          <div className="p-10">
            {error && (
              <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-red-600 animate-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yönetici E-Posta</label>
                <div className="relative group">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-accent transition-colors" size={20} />
                   <input 
                     type="email" 
                     required
                     className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all" 
                     placeholder="admin@meydan.com"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Güvenlik Anahtarı</label>
                <div className="relative group">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-accent transition-colors" size={20} />
                   <input 
                     type="password" 
                     required
                     className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all" 
                     placeholder="••••••••"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                   />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent text-white py-5 rounded-[24px] font-black text-sm shadow-2xl shadow-accent/30 hover:shadow-accent/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 group relative overflow-hidden disabled:opacity-70 disabled:scale-100"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <span>SİSTEME GİRİŞ YAP</span>
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-center space-x-4">
               <div className="flex items-center space-x-1.5 opacity-40">
                  <ShieldCheck size={14} className="text-slate-900" />
                  <span className="text-[9px] font-black text-slate-900 uppercase">Güvenli Bağlantı</span>
               </div>
               <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
               <span className="text-[9px] font-black text-slate-300 uppercase">v2.0.4-LATEST</span>
            </div>
          </div>
        </div>
        
        {/* Footer Links */}
        <p className="text-center mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          © 2026 Meydan Lokanta • Tüm Hakları Saklıdır
        </p>
      </div>
    </div>
  );
}
