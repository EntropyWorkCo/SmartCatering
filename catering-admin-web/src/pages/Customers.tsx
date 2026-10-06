import {
    Briefcase,
    Building2,
    Calendar,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Download,
    Loader2,
    RotateCcw,
    Search,
    User as UserIcon,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import { adisyonService } from "../lib/services/adisyonService";
import { billingService } from "../lib/services/billingService";
import { ekstreService } from "../lib/services/ekstreService";
import { pdfService } from "../lib/services/pdfService";
import { pricingService } from "../lib/services/pricingService";

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
  const [expandedCompanies, setExpandedCompanies] = useState<
    Record<string, boolean>
  >({});

  const [processing, setProcessing] = useState(false);

  // Bireysel Detay State
  type BireyselSectionTab = "OPEN" | "PAID" | "FINANCIAL";
  const [expandedBireysel, setExpandedBireysel] = useState<Record<string, boolean>>({});
  const [bireyselOrders, setBireyselOrders] = useState<Record<string, any[]>>({});
  const [loadingBireysel, setLoadingBireysel] = useState<Record<string, boolean>>({});
  const [bireyselTab, setBireyselTab] = useState<Record<string, BireyselSectionTab>>({});
  // Parcali Odeme Modal State
  const [partialModalUserId, setPartialModalUserId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialMethod, setPartialMethod] = useState("");
  const [partialDesc, setPartialDesc] = useState("");

  // Ekstre İndirme Modalı State
  const [ekstreModalVisible, setEkstreModalVisible] = useState(false);
  const [ekstreTargetGroup, setEkstreTargetGroup] = useState<any>(null);
  const [ekstreStartDate, setEkstreStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [ekstreEndDate, setEkstreEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Firma Özel Fiyatları State
  const [companyPrices, setCompanyPrices] = useState<
    Record<string, { two: string; three: string; four: string }>
  >({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .neq("role", "deleted");
      if (usersError) throw usersError;

      // Fetch adisyon (orders) to calculate balance
      const { data: ordersData, error: ordersError } = await supabase
        .from("adisyon")
        .select("*");
      if (ordersError) throw ordersError;

      // Fetch companies to map corporate users
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*");
      if (companiesError) throw companiesError;

      if (usersData) {
        const formattedUsers: User[] = usersData.map((profile: any) => {
          let isOwner = false;
          let userCompany = companiesData?.find(
            (c: any) => c.user_id === profile.id,
          );

          if (userCompany) {
            isOwner = true;
          } else {
            userCompany = companiesData?.find(
              (c: any) => c.id === profile.company_id,
            );
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
                return (
                  o.user_id === profile.id &&
                  !["CANCELLED", "İPTAL", "PAID", "ÖDENDI", "ÖDENDİ"].includes(
                    status,
                  )
                );
              });
              balance = Math.max(
                0,
                userOrders.reduce((sum: number, order: any) => {
                  if (order.order_type === "MANUAL_PAYMENT") {
                    return sum - (order.total_amount || 0);
                  }
                  return sum + (order.total_amount || 0);
                }, 0),
              );
            }
          }

          return {
            id: profile.id,
            name: profile.full_name || "İsimsiz Müşteri",
            phone: profile.phone || "Telefon Yok",
            company: userCompany ? userCompany.company_name : "Bireysel Üyelik",
            companyId: userCompany?.id,
            vkn: userCompany ? userCompany.tax_number : null,
            balance: balance,
            isOwner: isOwner,
            companyBalance: userCompany ? userCompany.balance || 0 : 0,
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
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const bireyselCustomers = filteredCustomers.filter(
    (c: User) => !c.company || c.company === "Bireysel Üyelik",
  );
  const kurumsalCustomers = filteredCustomers.filter(
    (c: User) => c.company && c.company !== "Bireysel Üyelik",
  );

  const groupedKurumsal = (() => {
    const groups: Record<
      string,
      {
        companyName: string;
        companyId: string;
        isCorporate: boolean;
        vkn: string;
        totalDebt: number;
        customers: User[];
      }
    > = {};
    for (const c of kurumsalCustomers) {
      const key = `${c.company}-${c.vkn || ""}`;
      if (!groups[key]) {
        groups[key] = {
          companyName: c.company || "İsimsiz Firma",
          companyId: c.companyId || "",
          isCorporate: true,
          vkn: c.vkn || "",
          totalDebt: c.companyBalance || 0,
          customers: [],
        };
      }
      groups[key].customers.push(c);
    }
    return Object.values(groups).sort((a, b) => b.totalDebt - a.totalDebt);
  })();

  // --- Bireysel Musteri Detay Fonksiyonlari ---

  const toggleBireysel = async (userId: string) => {
    const nextState = !expandedBireysel[userId];
    setExpandedBireysel((prev) => ({ ...prev, [userId]: nextState }));
    if (nextState && !bireyselOrders[userId]) {
      setLoadingBireysel((prev) => ({ ...prev, [userId]: true }));
      try {
        const orders = await adisyonService.getUserOrders(userId);
        setBireyselOrders((prev) => ({ ...prev, [userId]: orders }));
        setBireyselTab((prev) => ({ ...prev, [userId]: "OPEN" }));
      } catch (err) { console.error("Bireysel siparis yukleme hatasi:", err); }
      finally { setLoadingBireysel((prev) => ({ ...prev, [userId]: false })); }
    }
  };

  const handleClearBireyselDebt = async (customer: User) => {
    if (!window.confirm(`"${customer.name}" adli musterinin tum borcunu sifirlamak istediginizden emin misiniz? Bu islem geri alinamaz.`)) return;
    try {
      setProcessing(true);
      await adisyonService.clearUserDebt(customer.id);
      const orders = await adisyonService.getUserOrders(customer.id);
      setBireyselOrders((prev) => ({ ...prev, [customer.id]: orders }));
      await fetchCustomers();
      alert(`"${customer.name}" musterisinin borcu basariyla sifirlandi.`);
    } catch (err: any) { alert("Borc sifirlama hatasi: " + err.message); }
    finally { setProcessing(false); }
  };

  const handlePartialPayment = async () => {
    if (!partialModalUserId) return;
    const amount = parseFloat(partialAmount);
    if (!amount || amount <= 0) { alert("Gecerli bir tutar girin."); return; }
    const customer = customers.find((c) => c.id === partialModalUserId);
    if (!customer) return;
    try {
      setProcessing(true);
      await billingService.recordPayment(partialModalUserId, null, amount, partialMethod, partialDesc || customer.name);
      const orders = await adisyonService.getUserOrders(partialModalUserId);
      setBireyselOrders((prev) => ({ ...prev, [partialModalUserId!]: orders }));
      await fetchCustomers();
      setPartialModalUserId(null); setPartialAmount(""); setPartialMethod(""); setPartialDesc("");
      alert("Kismi odeme basariyla kaydedildi.");
    } catch (err: any) { alert("Odeme kaydi hatasi: " + err.message); }
    finally { setProcessing(false); }
  };

  const getBireyselOrders = (userId: string) => {
    const orders = bireyselOrders[userId] || [];
    const CLOSED = ["PAID", "ODENDI", "ÖDENDİ", "CANCELLED", "IPTAL", "İPTAL"];
    const openOrders = orders.filter((o) => o.order_type !== "MANUAL_PAYMENT" && o.order_type !== "MANUAL_DEBT" && !CLOSED.includes((o.status || "").toUpperCase()));
    const paidOrders = orders.filter((o) => o.order_type !== "MANUAL_PAYMENT" && o.order_type !== "MANUAL_DEBT" && CLOSED.includes((o.status || "").toUpperCase()));
    const financialOrders = orders.filter((o) => o.order_type === "MANUAL_PAYMENT" || o.order_type === "MANUAL_DEBT").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { openOrders, paidOrders, financialOrders };
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });


  const toggleCompany = async (groupKey: string, companyId: string) => {
    const nextState = !expandedCompanies[groupKey];
    setExpandedCompanies((prev) => ({
      ...prev,
      [groupKey]: nextState,
    }));

    if (nextState && !companyPrices[companyId]) {
      setLoadingPrices((prev) => ({ ...prev, [companyId]: true }));
      try {
        const pricesList = await pricingService.getCompanyPrices(companyId);
        const map: Record<number, string> = {};
        pricesList.forEach((p) => {
          map[p.selection_count] = p.unit_price.toString();
        });
        setCompanyPrices((prev) => ({
          ...prev,
          [companyId]: {
            two: map[2] || "0",
            three: map[3] || "0",
            four: map[4] || "0",
          },
        }));
      } catch (err) {
        console.error("Fiyat yükleme hatası:", err);
      } finally {
        setLoadingPrices((prev) => ({ ...prev, [companyId]: false }));
      }
    }
  };

  const handleSaveCompanyPrices = async (companyId: string) => {
    try {
      const pricesObj = companyPrices[companyId];
      if (!pricesObj) return;

      const rows = [
        { selectionCount: 2 as const, unitPrice: Number(pricesObj.two || 0) },
        { selectionCount: 3 as const, unitPrice: Number(pricesObj.three || 0) },
        { selectionCount: 4 as const, unitPrice: Number(pricesObj.four || 0) },
      ];

      await pricingService.setPrices(companyId, rows);
      alert("Özel fiyatlar başarıyla kaydedildi.");
    } catch (err: any) {
      console.error(err);
      alert("Fiyatlar kaydedilirken hata oluştu: " + err.message);
    }
  };

  const handleCloseMonthSingle = async (group: any) => {
    const owner = group.customers.find((c: any) => c.isOwner);
    const ownerUserId = owner?.id;
    if (!ownerUserId) {
      alert("Hata: Firma sahibi bulunamadı. Ay kapanışı yapılamaz.");
      return;
    }

    const employeeIds = group.customers
      .filter((c: any) => !c.isOwner)
      .map((c: any) => c.id);
    const companyName = group.companyName;

    if (
      !window.confirm(
        `DİKKAT!\n\n"${companyName}" firmasının ay kapanış işlemini onaylıyor musunuz? Bu firmanın bakiyesi sıfırlanacak ve tüm çalışan siparişleri kilitlenecektir. Bu işlem geri alınamaz!`,
      )
    ) {
      return;
    }

    try {
      setProcessing(true);
      await billingService.closeMonth(
        group.companyId,
        ownerUserId,
        employeeIds,
      );
      alert(`"${companyName}" firmasının ay kapanışı başarıyla tamamlandı.`);
      fetchCustomers(); // Refresh to update balances
    } catch (err: any) {
      console.error(err);
      alert("Ay kapanışı hatası: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const openEkstreModal = (group: any) => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setEkstreStartDate(formatDate(firstDay));
    setEkstreEndDate(formatDate(lastDay));
    setEkstreTargetGroup(group);
    setEkstreModalVisible(true);
  };

  const executeDownloadEkstre = async () => {
    if (!ekstreTargetGroup) return;
    try {
      setProcessing(true);
      const data = await ekstreService.getEkstreVerisi(
        ekstreTargetGroup.companyId,
        ekstreStartDate,
        ekstreEndDate,
      );

      pdfService.generateHesapEkstresi(data);
      setEkstreModalVisible(false);
    } catch (err: any) {
      console.error("Ekstre oluşturma hatası:", err);
      alert(
        `Ekstre oluşturulurken bir hata oluştu: ${err.message || "Bilinmeyen hata"}`,
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Müşteri Yönetimi
          </h1>
          <p className="text-slate-500 mt-1">
            Kayıtlı kullanıcıları ve firma borçlarını buradan takip edin.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setMainTab("KURUMSAL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${mainTab === "KURUMSAL" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Building2 size={16} />
            <span>Kurumsal</span>
          </button>
          <button
            onClick={() => setMainTab("BIREYSEL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${mainTab === "BIREYSEL" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-slate-500 hover:bg-slate-50"}`}
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
          <p className="text-slate-400 mt-4 font-bold uppercase tracking-widest text-xs italic">
            Veriler Hazırlanıyor...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {mainTab === "BIREYSEL" ? (
            <div className="grid grid-cols-1 gap-3">
              {bireyselCustomers.map((c) => {
                const isExpanded = expandedBireysel[c.id];
                const isLoadingOrders = loadingBireysel[c.id];
                const activeTab = bireyselTab[c.id] || "OPEN";
                const { openOrders, paidOrders, financialOrders } = getBireyselOrders(c.id);
                return (
                  <div key={c.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50">
                    <div className="p-5 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors group" onClick={() => toggleBireysel(c.id)}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-lg group-hover:scale-105 transition-transform">{c.name.charAt(0)}</div>
                        <div><p className="text-sm font-black text-slate-800">{c.name}</p><p className="text-xs text-slate-400 italic underline mt-0.5">{c.phone}</p></div>
                      </div>
                      <div className="flex items-center gap-4">
                        {c.balance && c.balance > 0 ? (
                          <div className="text-right"><p className="text-sm font-black text-red-500">₺{(c.balance ?? 0).toLocaleString("tr-TR")}</p><p className="text-[9px] font-black text-red-400 uppercase tracking-tighter">BORÇLU</p></div>
                        ) : (
                          <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">TEMİZ</span>
                        )}
                        {isExpanded ? <ChevronUp className="text-slate-300" size={20} /> : <ChevronDown className="text-slate-300" size={20} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top duration-300">
                        {isLoadingOrders ? (
                          <div className="py-12 flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 text-accent animate-spin" /><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Yükleniyor...</p></div>
                        ) : (
                          <div className="p-6 space-y-5">
                            <div className="flex items-center gap-3">
                              <div className={`flex-1 rounded-2xl border p-4 ${c.balance && c.balance > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${c.balance && c.balance > 0 ? "text-red-400" : "text-emerald-500"}`}>Güncel Borç</p>
                                <p className={`text-2xl font-black mt-1 ${c.balance && c.balance > 0 ? "text-red-500" : "text-emerald-500"}`}>{c.balance && c.balance > 0 ? `₺${c.balance.toLocaleString("tr-TR")}` : "Temiz"}</p>
                              </div>
                              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Toplam Sipariş</p>
                                <p className="text-2xl font-black text-slate-800 mt-1">{(bireyselOrders[c.id] || []).filter((o) => o.order_type !== "MANUAL_PAYMENT" && o.order_type !== "MANUAL_DEBT").length}</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => { setPartialModalUserId(c.id); setPartialDesc(c.name); }} disabled={processing} className="flex-1 flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-accent/90 transition-all disabled:opacity-50 cursor-pointer">
                                <CreditCard size={14} />Kısmi Ödeme Al
                              </button>
                              {c.balance && c.balance > 0 ? (
                                <button onClick={() => handleClearBireyselDebt(c)} disabled={processing} className="flex-1 flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 hover:bg-red-600 hover:text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer">
                                  <RotateCcw size={14} />Borcu Sıfırla
                                </button>
                              ) : null}
                            </div>
                            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1">
                              {([{ key: "OPEN", label: `Açık (${openOrders.length})` }, { key: "PAID", label: `Ödendi (${paidOrders.length})` }, { key: "FINANCIAL", label: `Hareketler (${financialOrders.length})` }] as { key: any; label: string }[]).map((tab) => (
                                <button key={tab.key} onClick={() => setBireyselTab((prev) => ({ ...prev, [c.id]: tab.key }))} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.key ? "bg-accent text-white shadow-md shadow-accent/20" : "text-slate-500 hover:bg-slate-50"}`}>{tab.label}</button>
                              ))}
                            </div>
                            <div className="space-y-2">
                              {activeTab === "OPEN" && (openOrders.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm font-medium">Açık sipariş bulunmuyor ✓</div> : openOrders.map((order) => (
                                <div key={order.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                                  <div><p className="text-xs font-black text-slate-700">{formatDate(order.created_at)}</p><p className="text-[10px] text-slate-400 mt-0.5">{order.order_type || "Sipariş"}</p></div>
                                  <div className="flex items-center gap-3">{order.total_amount > 0 && <p className="text-sm font-black text-slate-800">₺{order.total_amount.toLocaleString("tr-TR")}</p>}<span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-tight">Açık</span></div>
                                </div>
                              )))}
                              {activeTab === "PAID" && (paidOrders.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm font-medium">Ödendi kaydı bulunmuyor</div> : paidOrders.map((order) => (
                                <div key={order.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between opacity-70">
                                  <div><p className="text-xs font-black text-slate-700">{formatDate(order.created_at)}</p><p className="text-[10px] text-slate-400 mt-0.5">{order.order_type || "Sipariş"}</p></div>
                                  <div className="flex items-center gap-3">{order.total_amount > 0 && <p className="text-sm font-black text-slate-800">₺{order.total_amount.toLocaleString("tr-TR")}</p>}<span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-tight">Ödendi</span></div>
                                </div>
                              )))}
                              {activeTab === "FINANCIAL" && (financialOrders.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm font-medium">Finansal hareket bulunmuyor</div> : financialOrders.map((entry) => {
                                const isPayment = entry.order_type === "MANUAL_PAYMENT";
                                return (
                                  <div key={entry.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                                    <div><p className="text-xs font-black text-slate-700">{entry.note || (isPayment ? "Kısmi Ödeme" : "Borç Girişi")}</p><p className="text-[10px] text-slate-400 mt-0.5">{formatDate(entry.created_at)}</p></div>
                                    <div className="flex items-center gap-3">
                                      {entry.total_amount > 0 && <p className={`text-sm font-black ${isPayment ? "text-emerald-600" : "text-slate-800"}`}>{isPayment ? "-" : "+"}₺{entry.total_amount.toLocaleString("tr-TR")}</p>}
                                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight border ${isPayment ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>{isPayment ? "Ödeme" : "Borç"}</span>
                                    </div>
                                  </div>
                                );
                              }))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {groupedKurumsal.map((group) => {
                const groupKey = `${group.companyName}-${group.vkn}`;
                const isExpanded = expandedCompanies[groupKey];
                return (
                  <div
                    key={groupKey}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/50"
                  >
                    <div
                      className="p-6 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors border-b border-transparent group"
                      onClick={() => toggleCompany(groupKey, group.companyId)}
                    >
                      <div className="flex items-center space-x-6">
                        <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 leading-tight">
                            {group.companyName}
                          </h3>
                          <div className="flex items-center gap-4 mt-1">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                              <Briefcase size={12} className="inline mr-1" />
                              {group.customers.length} Kayıtlı Çalışan
                            </p>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                              Bakiye:{" "}
                              <strong
                                className={
                                  group.totalDebt > 0
                                    ? "text-red-500 font-black"
                                    : "text-emerald-500 font-black"
                                }
                              >
                                ₺{(group.totalDebt ?? 0).toLocaleString("tr-TR")}
                              </strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-8">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEkstreModal(group);
                          }}
                          className="p-2.5 bg-red-600 text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-red-100 flex items-center cursor-pointer"
                          title="Ekstre İndir"
                          disabled={processing}
                        >
                          <Download
                            size={20}
                            className={processing ? "animate-pulse" : ""}
                          />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="text-slate-300" />
                        ) : (
                          <ChevronDown className="text-slate-300" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50/50 p-8 border-t border-slate-100 animate-in slide-in-from-top duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Left side - Employee List */}
                          <div className="lg:col-span-2 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                              Çalışan Listesi
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {group.customers.map((c) => (
                                <div
                                  key={c.id}
                                  className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm relative overflow-hidden group/item"
                                >
                                  {c.isOwner && (
                                    <div className="absolute top-0 right-0 bg-accent text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                                      Firma Sahibi
                                    </div>
                                  )}
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                                      {c.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-700">
                                        {c.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 italic underline">
                                        {c.phone}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right side - Pricing and Closing Operations */}
                          <div className="space-y-6">
                            {/* Custom Pricing Panel */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                Firma Özel Tabldot Fiyatları
                              </h4>

                              {loadingPrices[group.companyId] ? (
                                <div className="flex justify-center py-6">
                                  <Loader2
                                    className="animate-spin text-accent"
                                    size={24}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-600">
                                      2'li Tabldot
                                    </span>
                                    <div className="relative w-28">
                                      <input
                                        type="number"
                                        value={
                                          companyPrices[group.companyId]?.two ||
                                          "0"
                                        }
                                        onChange={(e) =>
                                          setCompanyPrices((prev) => ({
                                            ...prev,
                                            [group.companyId]: {
                                              ...prev[group.companyId]!,
                                              two: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-right pr-8 outline-none focus:border-accent"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                        ₺
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-600">
                                      3'lü Tabldot
                                    </span>
                                    <div className="relative w-28">
                                      <input
                                        type="number"
                                        value={
                                          companyPrices[group.companyId]
                                            ?.three || "0"
                                        }
                                        onChange={(e) =>
                                          setCompanyPrices((prev) => ({
                                            ...prev,
                                            [group.companyId]: {
                                              ...prev[group.companyId]!,
                                              three: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-right pr-8 outline-none focus:border-accent"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                        ₺
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-600">
                                      4'lü Tabldot
                                    </span>
                                    <div className="relative w-28">
                                      <input
                                        type="number"
                                        value={
                                          companyPrices[group.companyId]
                                            ?.four || "0"
                                        }
                                        onChange={(e) =>
                                          setCompanyPrices((prev) => ({
                                            ...prev,
                                            [group.companyId]: {
                                              ...prev[group.companyId]!,
                                              four: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-right pr-8 outline-none focus:border-accent"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                        ₺
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      handleSaveCompanyPrices(group.companyId)
                                    }
                                    className="w-full bg-accent text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-accent/90 transition-all cursor-pointer mt-2"
                                  >
                                    Fiyatları Kaydet
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Operations Panel */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Firma İşlemleri
                              </h4>
                              <button
                                onClick={() => handleCloseMonthSingle(group)}
                                disabled={processing}
                                className="w-full bg-red-50 border border-red-100 hover:bg-red-600 hover:text-white text-red-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                              >
                                Firma Ay Kapanışı Yap
                              </button>
                            </div>
                          </div>
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
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  Ekstre İndir
                </h2>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                  {ekstreTargetGroup.companyName || ekstreTargetGroup.name}
                </p>
              </div>
              <button
                onClick={() => setEkstreModalVisible(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                <p className="text-xs text-accent font-semibold leading-relaxed">
                  Seçtiğiniz başlangıç tarihinden önceki tüm ödenmemiş borçlar{" "}
                  <strong className="font-black">
                    Geçmişten Devreden Borç
                  </strong>{" "}
                  olarak; seçili tarihler arasındaki siparişler ve finansal
                  hareketler ise detaylı döküm olarak listelenecektir.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                    Başlangıç Tarihi
                  </label>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                    Bitiş Tarihi
                  </label>
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
                  {processing ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
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

      {/* Bireysel Kismi Odeme Modali */}
      {partialModalUserId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div><h2 className="text-2xl font-black text-slate-900 leading-tight">Kısmi Ödeme Al</h2><p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">{customers.find((c) => c.id === partialModalUserId)?.name}</p></div>
              <button onClick={() => setPartialModalUserId(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Ödeme Tutarı (₺)</label><input type="number" placeholder="0.00" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-black focus:outline-none focus:border-accent transition-all" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Ödeme Yöntemi</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Nakit", "Havale", "Kredi Kartı"].map((method) => (
                    <button key={method} onClick={() => setPartialMethod(method)} className={`py-3 rounded-2xl text-xs font-black transition-all border ${partialMethod === method ? "bg-accent text-white border-accent shadow-md" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-accent/50"}`}>{method}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Açıklama (opsiyonel)</label><input type="text" placeholder="Ödeme notu..." value={partialDesc} onChange={(e) => setPartialDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-accent transition-all" /></div>
              <div className="pt-2 flex items-center space-x-3">
                <button onClick={() => setPartialModalUserId(null)} className="flex-1 py-4 text-slate-500 font-black text-sm hover:bg-slate-50 rounded-2xl transition-colors">İPTAL</button>
                <button onClick={handlePartialPayment} disabled={processing || !partialAmount} className="flex-[2] bg-accent py-4 rounded-2xl text-white font-black text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2">
                  {processing ? <Loader2 className="animate-spin" size={18} /> : <><CreditCard size={18} /><span>KAYDET</span></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
