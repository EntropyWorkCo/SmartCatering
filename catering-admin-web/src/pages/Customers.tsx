import { useEffect, useState } from "react";
import { 
  Building2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  User as UserIcon,
  Loader2,
  MoreVertical,
  Briefcase,
  Calendar,
  X,
  Download
} from "lucide-react";
import { supabase } from "../lib/supabase";

import { adisyonService } from "../lib/services/adisyonService";
import { pdfService } from "../lib/services/pdfService";

interface User {
  id: string;
  name: string;
  phone: string;
  company?: string;
  companyId?: string;
  vkn?: string | null;
  balance?: number;
  isOwner?: boolean;
  companyBalance?: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mainTab, setMainTab] = useState<"BIREYSEL" | "KURUMSAL">("KURUMSAL");
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  const [processing, setProcessing] = useState(false);

  // Ekstre İndirme Modalı State
  const [ekstreModalVisible, setEkstreModalVisible] = useState(false);
  const [ekstreTargetGroup, setEkstreTargetGroup] = useState<any>(null);
  const [ekstreStartDate, setEkstreStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [ekstreEndDate, setEkstreEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [ekstreUnitPrice, setEkstreUnitPrice] = useState("0");

  


  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // Fetch users
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) throw usersError;

      // Fetch adisyon (orders) to calculate balance
      const { data: ordersData, error: ordersError } = await supabase.from('adisyon').select('*');
      if (ordersError) throw ordersError;

      // Fetch companies to map corporate users
      const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*');
      if (companiesError) throw companiesError;

      if (usersData) {
        const formattedUsers: User[] = usersData.map((profile: any) => {
          let isOwner = false;
          let userCompany = companiesData?.find((c: any) => c.user_id === profile.id);
          
          if (userCompany) {
            isOwner = true;
          } else {
            userCompany = companiesData?.find((c: any) => c.id === profile.company_id);
          }

          let balance = 0;
          if (isOwner && userCompany) {
            balance = userCompany.balance || 0;
          } else if (userCompany) {
            balance = 0;
          } else {
            if (ordersData) {
              const userOrders = ordersData.filter((o: any) => {
                const status = (o.status || "").toUpperCase();
                return o.user_id === profile.id && !["CANCELLED", "İPTAL", "PAID", "ÖDENDI", "ÖDENDİ"].includes(status);
              });
              balance = userOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
            }
          }

          return {
            id: profile.id,             
            name: profile.full_name || 'İsimsiz Müşteri',
            phone: profile.phone || 'Telefon Yok',
            company: userCompany ? userCompany.company_name : 'Bireysel Üyelik',
            companyId: userCompany?.id,
            vkn: userCompany ? userCompany.tax_number : null,
            balance: balance,
            isOwner: isOwner,
            companyBalance: userCompany ? (userCompany.balance || 0) : 0
          };
        });
        setCustomers(formattedUsers);
      }
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c: User) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const bireyselCustomers = filteredCustomers.filter((c: User) => !c.company || c.company === 'Bireysel Üyelik');
  const kurumsalCustomers = filteredCustomers.filter((c: User) => c.company && c.company !== 'Bireysel Üyelik');

  const groupedKurumsal = (() => {
    const groups: Record<string, { companyName: string; companyId: string; isCorporate: boolean; vkn: string; totalDebt: number; customers: User[] }> = {};
    for (const c of kurumsalCustomers) {
      const key = `${c.company}-${c.vkn || ''}`;
      if (!groups[key]) {
        groups[key] = { 
          companyName: c.company || 'İsimsiz Firma', 
          companyId: c.companyId || '',
          isCorporate: true,
          vkn: c.vkn || '', 
          totalDebt: c.companyBalance || 0, 
          customers: [] 
        };
      }
      groups[key].customers.push(c);
    }
    return Object.values(groups).sort((a, b) => b.totalDebt - a.totalDebt);
  })();

  const toggleCompany = (vkn: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [vkn]: !prev[vkn]
    }));
  };



  const openEkstreModal = (group: any) => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const pad = (n: number) => n < 10 ? '0' + n : n.toString();
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setEkstreStartDate(formatDate(firstDay));
    setEkstreEndDate(formatDate(lastDay));
    setEkstreTargetGroup(group);
    setEkstreModalVisible(true);
  };

  const executeDownloadEkstre = async () => {
    if (!ekstreTargetGroup) return;
    try {
      setProcessing(true);
      const orders = await adisyonService.getCompanyOrders(ekstreTargetGroup.companyId);
      
      const start = new Date(ekstreStartDate + "T00:00:00");
      const end = new Date(ekstreEndDate + "T23:59:59");

      let bu_donemin_borcu = 0;
      const donemIciIslemler: any[] = [];

      for (const o of orders) {
        const d = new Date(o.created_at || o.date);
        const tutar = o.total_amount || 0;
        const statusUpper = (o.status || "").toUpperCase();
        const isPaid = ["PAID", "ÖDENDI", "ÖDENDİ", "COMPLETED", "TAMAMLANDI"].includes(statusUpper);
        const isCancelled = ["CANCELLED", "İPTAL"].includes(statusUpper);
        if (isCancelled) continue;
        if (d >= start && d <= end) {
          if (!isPaid) bu_donemin_borcu += tutar;
          donemIciIslemler.push(o);
        }
      }

      donemIciIslemler.sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());

      const account = {
        displayName: ekstreTargetGroup.companyName,
        isCorporate: true,
        manualDebt: ekstreTargetGroup.totalDebt || bu_donemin_borcu,
        total: bu_donemin_borcu,
      };

      pdfService.generateCompanyExtre(account, donemIciIslemler);
      setEkstreModalVisible(false);
    } catch (err: any) {
      console.error("Ekstre oluşturma hatası:", err);
      alert(`Ekstre oluşturulurken bir hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Müşteri Yönetimi</h1>
          <p className="text-slate-500 mt-1">Kayıtlı kullanıcıları ve firma borçlarını buradan takip edin.</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setMainTab("KURUMSAL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${mainTab === 'KURUMSAL' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Building2 size={16} />
            <span>Kurumsal</span>
          </button>
          <button 
            onClick={() => setMainTab("BIREYSEL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${mainTab === 'BIREYSEL' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <UserIcon size={16} />
            <span>Bireysel</span>
          </button>
        </div>
      </div>

      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text"
          placeholder="İsim, telefon veya firma ara..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent shadow-sm transition-all shadow-slate-100"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto scale-110" />
            <p className="text-slate-400 mt-4 font-bold uppercase tracking-widest text-xs italic">Veriler Hazırlanıyor...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mainTab === "BIREYSEL" ? (
             <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-slate-50/50 text-slate-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-100">
                         <th className="px-6 py-5">Müşteri</th>
                         <th className="px-6 py-5">İletişim</th>
                         <th className="px-6 py-5">Bakiye / Borç</th>

                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {bireyselCustomers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-5">
                              <div className="flex items-center space-x-4">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 shadow-inner">
                                    {c.name.charAt(0)}
                                 </div>
                                 <span className="text-sm font-bold text-slate-800">{c.name}</span>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <span className="text-sm text-slate-500 font-medium italic underline">{c.phone}</span>
                           </td>
                           <td className="px-6 py-5">
                              {c.balance && c.balance > 0 ? (
                                <div className="flex flex-col">
                                   <span className="text-sm font-black text-red-500 italic">₺{c.balance.toLocaleString("tr-TR")}</span>
                                   <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter mt-0.5">BORÇLU</span>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">TEMİZ</span>
                              )}
                           </td>

                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
               {groupedKurumsal.map(group => {
                  const groupKey = `${group.companyName}-${group.vkn}`;
                  const isExpanded = expandedCompanies[groupKey];
                  return (
                    <div key={groupKey} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50">
                       <div 
                         className="p-6 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors border-b border-transparent group"
                         onClick={() => toggleCompany(groupKey)}
                       >
                          <div className="flex items-center space-x-6">
                             <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                                <Building2 size={24} />
                             </div>
                             <div>
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{group.companyName}</h3>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                   <Briefcase size={12} className="inline mr-1" />
                                   {group.customers.length} Kayıtlı Çalışan
                                </p>
                             </div>
                           </div>

                           <div className="flex items-center space-x-8">
                             <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEkstreModal(group);
                                }}
                                className="p-2 bg-red-600 text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-red-100 flex items-center"
                                title="Ekstre İndir"
                                disabled={processing}
                              >
                                 <Download size={20} className={processing ? "animate-pulse" : ""} />
                              </button>
                             {isExpanded ? <ChevronUp className="text-slate-300" /> : <ChevronDown className="text-slate-300" />}
                          </div>
                       </div>

                       {isExpanded && (
                         <div className="bg-slate-50/50 p-6 space-y-3 animate-in slide-in-from-top duration-300">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Çalışan Listesi</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {group.customers.map(c => (
                                 <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm relative overflow-hidden group/item">
                                    {c.isOwner && <div className="absolute top-0 right-0 bg-accent text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">Firma Sahibi</div>}
                                    <div className="flex items-center space-x-3">
                                       <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                                         {c.name.charAt(0)}
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold text-slate-700">{c.name}</p>
                                          <p className="text-[10px] text-slate-400 italic underline">{c.phone}</p>
                                       </div>
                                    </div>
                                    <button className="p-2 text-slate-200 hover:text-slate-600 transition-colors opacity-0 group-hover/item:opacity-100">
                                       <MoreVertical size={14} />
                                    </button>
                                 </div>
                               ))}
                            </div>
                         </div>
                       )}
                    </div>
                  );
               })}
            </div>
          )}
        </div>
      )}

      {/* Ekstre İndirme Modalı */}
      {ekstreModalVisible && ekstreTargetGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">Ekstre İndir</h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">{ekstreTargetGroup.companyName || ekstreTargetGroup.name}</p>
                 </div>
                 <button onClick={() => setEkstreModalVisible(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                 </button>
              </div>

              <div className="p-8 space-y-6">
                 <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                    <p className="text-xs text-accent font-semibold leading-relaxed">
                       Seçtiğiniz başlangıç tarihinden önceki tüm ödenmemiş borçlar <strong className="font-black">Geçmişten Devreden Borç</strong> olarak; seçili tarihler arasındaki siparişler ise <strong className="font-black">Bu Dönemin Tüketimi</strong> olarak listelenecektir.
                    </p>
                 </div>
                 
                 <div style={{ marginBottom: '24px' }}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Dönem Birim Fiyatı (₺)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={ekstreUnitPrice}
                        onChange={(e) => setEkstreUnitPrice(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xl font-black focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                        placeholder="0.00"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">TL</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Başlangıç Tarihi</label>
                        <div className="relative">
                           <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                           <input 
                             type="date"
                             value={ekstreStartDate}
                             onChange={(e) => setEkstreStartDate(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-accent"
                           />
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Bitiş Tarihi</label>
                        <div className="relative">
                           <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                           <input 
                             type="date"
                             value={ekstreEndDate}
                             onChange={(e) => setEkstreEndDate(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-accent"
                           />
                        </div>
                     </div>
                  </div>



                 <div className="pt-4 flex items-center space-x-3">
                    <button 
                      onClick={() => setEkstreModalVisible(false)}
                      className="flex-1 py-4 text-slate-500 font-black text-sm hover:bg-slate-50 rounded-2xl transition-colors"
                    >
                       İPTAL
                    </button>
                    <button 
                      onClick={executeDownloadEkstre}
                      disabled={processing}
                      className="flex-[2] bg-red-500 py-4 rounded-2xl text-white font-black text-sm shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                       {processing ? <Loader2 className="animate-spin" size={18} /> : (
                          <>
                             <Download size={18} />
                             <span>PDF OLUŞTUR</span>
                          </>
                       )}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
