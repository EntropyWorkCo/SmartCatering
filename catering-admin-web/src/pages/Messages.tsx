import { useEffect, useState } from "react";
import { 
  MessageSquare, 
  Receipt, 
  Send, 
  Clock, 
  Search,
  Loader2,
  Reply,
  CheckCheck,
  X,
  AlertCircle
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Messages() {
  const [activeTab, setActiveTab] = useState<"ORDERS" | "PRIVATE">("ORDERS");
  const [privateMessages, setPrivateMessages] = useState<any[]>([]);
  const [orderMessages, setOrderMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchData();

    // Sadece messages tablosunu dinle — adisyon değişikliklerinde mesaj sayfasının refresh yapmasına gerek yok
    const channel = supabase.channel('messages_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          // Sadece yeni gelen mesajları local state'e ekle
          const m = payload.new as any;
          if (!m.is_from_admin) {
            // Kullanıcı adını bilmiyoruz, fetch et
            fetchData();
          }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Private Messages — son 200 mesaj yeterli
      const { data: pData } = await supabase
          .from("messages")
          .select("*, users(id, full_name, companies!users_company_id_fkey(company_name))")
          .order("created_at", { ascending: false })
          .limit(200);

      if (pData) {
          const formattedP = pData.map((m: any) => {
              const user = m.users?.[0] || m.users;
              const company = user?.["companies!users_company_id_fkey"]?.[0] || user?.["companies!users_company_id_fkey"] || user?.companies?.[0] || user?.companies;
              return {
                  id: m.id,
                  userId: user?.id,
                  userName: user?.full_name || "Müşteri",
                  companyName: company?.company_name || null,
                  date: new Date(m.created_at),
                  note: m.content,
                  is_read: m.is_read,
                  is_from_admin: m.is_from_admin
              };
          });
          setPrivateMessages(formattedP);
      }

      // 2. Fetch Order Messages — son 90 gün ve 200 kayıt
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: oData } = await supabase
          .from("adisyon")
          .select("*, users(full_name, companies!users_company_id_fkey(company_name))")
          .not("note", "is", null)
          .not("note", "eq", "")
          .not("order_type", "eq", "MANUAL_DEBT")
          .gte("created_at", ninetyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(200);

      if (oData) {
          const formattedO = oData.map((o: any) => {
              const user = o.users?.[0] || o.users;
              const company = user?.["companies!users_company_id_fkey"]?.[0] || user?.["companies!users_company_id_fkey"] || user?.companies?.[0] || user?.companies;
              return {
                  id: o.id,
                  userName: user?.full_name || "Müşteri",
                  companyName: company?.company_name || null,
                  orderNumber: String(o.id).substring(0, 6).toUpperCase(),
                  date: new Date(o.created_at),
                  note: o.note,
                  status: o.status
              };
          });
          setOrderMessages(formattedO);
      }
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    await supabase.from("messages").update({ is_read: true }).eq("id", id);
    setPrivateMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() || !replyingTo) return;

    setSendingReply(true);
    try {
        const { error } = await supabase.from("messages").insert({
            user_id: replyingTo.userId,
            content: replyContent.trim(),
            is_from_admin: true,
            is_read: false
        });

        if (error) throw error;

        // Cevabı local state'e ekle, DB'ye gitmeden
        const sentMessage = {
          id: Date.now().toString(),
          userId: replyingTo.userId,
          userName: "Admin",
          companyName: null,
          date: new Date(),
          note: replyContent.trim(),
          is_read: true,
          is_from_admin: true
        };
        setPrivateMessages(prev => [sentMessage, ...prev]);

        setReplyingTo(null);
        setReplyContent("");
    } catch (error: any) {
        alert("Hata: " + error.message);
    } finally {
        setSendingReply(false);
    }
  };

  const filteredOrders = orderMessages.filter(m => 
    m.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.companyName && m.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPrivate = privateMessages.filter(m => 
    !m.is_from_admin && (
      m.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (m.companyName && m.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mesajlar & Notlar</h1>
          <p className="text-slate-500 mt-1">Müşteri geri bildirimlerini ve sipariş notlarını takip edin.</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab("ORDERS")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'ORDERS' ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Receipt size={16} />
            <span>Sipariş Notları</span>
          </button>
          <button 
            onClick={() => setActiveTab("PRIVATE")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'PRIVATE' ? 'bg-accent text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
             <MessageSquare size={16} />
             <span>Özel Mesajlar</span>
          </button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text"
          placeholder="İsim veya firma ara..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent shadow-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto opacity-50" />
            <p className="text-slate-400 mt-4 font-bold uppercase tracking-widest text-[10px]">Mesajlar Senkronize Ediliyor...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {(activeTab === "ORDERS" ? filteredOrders : filteredPrivate).map(msg => (
             <div key={msg.id} className={`bg-white rounded-3xl p-6 border transition-all hover:shadow-xl hover:shadow-slate-200/50 flex flex-col justify-between ${!msg.is_read && activeTab === 'PRIVATE' ? 'border-accent ring-1 ring-accent/20' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between mb-4">
                   <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 font-bold uppercase">
                         {msg.userName.charAt(0)}
                      </div>
                      <div>
                         <h3 className="font-bold text-slate-800 leading-tight">{msg.userName}</h3>
                         <p className="text-[10px] text-accent font-bold uppercase tracking-widest leading-none mt-1">{msg.companyName || "Bireysel Müşteri"}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{msg.date.toLocaleDateString('tr-TR')}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                </div>

                <div className="bg-slate-50 border border-slate-100/50 p-4 rounded-2xl mb-6 relative">
                   <p className="text-sm text-slate-700 italic leading-relaxed font-medium">"{msg.note.replace('[MİSAFİRLE BERABER]', '').trim()}"</p>
                   {msg.note.includes('[MİSAFİRLE BERABER]') && (
                     <div className="absolute -top-2 -right-2 bg-accent text-[8px] font-black text-white px-2 py-1 rounded-full shadow-lg shadow-accent/20">MİSAFİR VAR</div>
                   )}
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    <div className="flex items-center space-x-2">
                       {activeTab === "ORDERS" ? (
                         <div className="flex items-center space-x-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                           <Clock size={12} />
                           <span>Sipariş #{msg.orderNumber}</span>
                         </div>
                       ) : (
                         <div className={`flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest ${msg.is_read ? 'text-slate-400' : 'text-accent animate-pulse'}`}>
                           {msg.is_read ? <CheckCheck size={12} /> : <AlertCircle size={12} />}
                           <span>{msg.is_read ? 'Okundu' : 'Bekleyen Mesaj'}</span>
                         </div>
                       )}
                    </div>

                    <div className="flex items-center space-x-2">
                       {activeTab === "PRIVATE" && !msg.is_read && (
                          <button 
                            onClick={() => markRead(msg.id)}
                            className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all"
                          >
                             OKUDUM
                          </button>
                       )}
                       {activeTab === "PRIVATE" && (
                          <button 
                            onClick={() => setReplyingTo(msg)}
                            className="bg-accent text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center space-x-1.5 shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                          >
                             <Reply size={14} />
                             <span>CEVAPLA</span>
                          </button>
                       )}
                    </div>
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Reply Modal Placeholder */}
      {replyingTo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h3 className="font-black text-slate-900 italic">Mesajı Cevapla</h3>
                 <button onClick={() => setReplyingTo(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-500 text-xs">
                    "{replyingTo.note}"
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cevabınız</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold min-h-[140px] focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none"
                      placeholder="Müşteriye iletilecek cevabı yazın..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                    ></textarea>
                 </div>
                 <button 
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyContent.trim()}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/30 flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                 >
                    {sendingReply ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    <span>GÖNDER & BİLDİRİM GİTSİN</span>
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
