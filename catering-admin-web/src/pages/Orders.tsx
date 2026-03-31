import { useEffect, useState } from "react";
import { 
  Search, 
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Play,
  Check,
  X
} from "lucide-react";
import { adisyonService } from "../lib/services/adisyonService";

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await adisyonService.getAllOrders();
      setOrders(data || []);
    } catch (error) {
      console.error("Orders fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await adisyonService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error("Status update error:", error);
      alert("Durum güncellenirken hata oluştu.");
    }
  };

  const filteredOrders = orders.filter(order => {
    // Sadece "Teslimat" gereken siparişleri göster (Paket, Sipariş Ver vb.)
    // "Şimdi Ye" kullanıcıları yemekhaneden aldığı için canlı listede görünmezler.
    if (order.order_type === "Şimdi Ye") return false;

    const matchesSearch = 
      order.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(order.id).includes(searchTerm);
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-600 border border-orange-200 uppercase tracking-wider"><Clock size={12} className="mr-1"/> BEKLİYOR</span>;
      case 'PREPARING':
        return <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-wider"><Package size={12} className="mr-1"/> HAZIRLANIYOR</span>;
      case 'READY':
        return <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-600 border border-indigo-200 uppercase tracking-wider"><Truck size={12} className="mr-1"/> YOLDA</span>;
      case 'COMPLETED':
      case 'TAMAMLANDI':
        return <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200 uppercase tracking-wider"><CheckCircle2 size={12} className="mr-1"/> TAMAMLANDI</span>;
      case 'CANCELLED':
        return <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-600 border border-red-200 uppercase tracking-wider"><XCircle size={12} className="mr-1"/> İPTAL EDİLDİ</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sipariş Yönetimi</h1>
          <p className="text-slate-500 mt-1 font-medium italic">Tüm aktif ve geçmiş siparişleri buradan yönetin.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Müşteri veya Şirket Ara..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="w-full md:w-48 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-accent/10 outline-none cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Tüm Durumlar</option>
          <option value="PENDING">Bekleyenler</option>
          <option value="PREPARING">Hazırlananlar</option>
          <option value="READY">Yoldakiler</option>
          <option value="COMPLETED">Tamamlananlar</option>
          <option value="CANCELLED">İptal Edilenler</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarih / ID</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Müşteri / Kurum</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Sipariş Detayı</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Durum</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Sıradaki Adım</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                    <p className="font-bold uppercase tracking-widest text-xs">Siparişler Yükleniyor...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                    Sipariş bulunamadı.
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-800">#{String(order.id).substring(0, 8)}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1">{new Date(order.created_at).toLocaleString('tr-TR')}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-800 uppercase tracking-tight">{order.userName}</div>
                    {order.companyName && (
                      <div className="text-[10px] font-black text-accent uppercase tracking-widest mt-1">{order.companyName}</div>
                    )}
                  </td>
                  <td className="px-8 py-6 max-w-xs">
                    <div className="text-xs font-bold text-slate-600 leading-relaxed truncate">{order.note || 'Standart Menü'}</div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1 italic">{order.order_type}</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end">{getStatusBadge(order.status)}</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {order.status === 'PENDING' && (
                        <button 
                          onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                        >
                          <Play size={12} fill="currentColor"/> <span>HAZIRLA</span>
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button 
                          onClick={() => handleStatusUpdate(order.id, order.order_type === 'PAKET' || order.order_type === 'Sipariş Ver' ? 'READY' : 'COMPLETED')}
                          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 hover:scale-105 transition-all"
                        >
                          <Truck size={14}/> <span>{order.order_type === 'PAKET' || order.order_type === 'Sipariş Ver' ? 'YOLA ÇIKAR' : 'TAMAMLA'}</span>
                        </button>
                      )}
                      {order.status === 'READY' && (
                        <button 
                          onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-200 hover:scale-105 transition-all"
                        >
                          <Check size={14}/> <span>TESLİM ET</span>
                        </button>
                      )}
                      
                      {['PENDING', 'PREPARING', 'READY'].includes(order.status) && (
                        <button 
                          onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors group-hover:opacity-100 opacity-50"
                          title="İptal Et"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
