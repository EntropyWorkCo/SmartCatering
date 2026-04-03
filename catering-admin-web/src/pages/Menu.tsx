import { useEffect, useState } from "react";
import { 
  Plus, 
  Trash2, 
  Search, 
  Utensils, 
  Coffee, 
  Soup, 
  Star,
  Save,
  Loader2,
  PlusCircle,
  Image as ImageIcon,
  FileDown,
  Upload,
  Ban,
  Check,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { menuService } from "../lib/services/menuService";

const CATEGORIES = [
  { id: "ÇORBA", label: "Çorba", icon: Soup },
  { id: "ANA YEMEK", label: "Ana Yemek", icon: Utensils },
  { id: "YARDIMCI", label: "Yardımcı", icon: Star },
  { id: "EKSTRA", label: "Ekstra", icon: PlusCircle },
  { id: "İÇECEK", label: "İçecek", icon: Coffee },
];

export default function MenuManagement() {
  const [activeTab, setActiveTab] = useState<"ADD" | "POOL" | "TODAY" | "FIXED">("TODAY");
  const [menu, setMenu] = useState<any[]>([]);
  const [systemPrices, setSystemPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Bulk Add State
  const [bulkItems, setBulkItems] = useState<any[]>([
    { id: "1", name: "", category: "ANA YEMEK", price: "180", image_url: null, image_base64: null }
  ]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const [allMenu, sysPrices] = await Promise.all([
        menuService.getAllMenu(),
        menuService.getSystemPrices()
      ]);
      setMenu(allMenu || []);
      setSystemPrices(sysPrices || []);
    } catch (error) {
      console.error("Menu fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, newStatus: string) => {
    try {
      await menuService.toggleItemStatus(id, newStatus as any);
      fetchMenu();
    } catch (error) {
      console.error("Toggle status error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu yemeği havuzdan tamamen silmek istediğinize emin misiniz?")) {
      try {
        await menuService.deleteMenuItem(id);
        fetchMenu();
      } catch (error) {
        console.error("Delete menu item error:", error);
      }
    }
  };

  const handlePublish = async () => {
    if (confirm("Bugünün menüsünü yayınlamak ve müşterilere bildirim göndermek istiyor musunuz?")) {
      try {
        await menuService.publishDraftMenu();
        alert("Menü başarıyla yayınlandı ve bildirimler gönderildi!");
        fetchMenu();
      } catch (error) {
        console.error("Publish error:", error);
      }
    }
  };

  const handleAddBulkRow = () => {
    setBulkItems([...bulkItems, { id: Date.now().toString(), name: "", category: "ANA YEMEK", price: "180", image_url: null, image_base64: null }]);
  };

  const handleSaveBulk = async () => {
    const validItems = bulkItems.filter(i => i.name.trim() !== "");
    if (validItems.length === 0) return alert("Lütfen en az bir yemek adı girin.");

    try {
      setLoading(true);
      for (const item of validItems) {
        await menuService.addMenuItem(item.name, item.category, Number(item.price), item.image_url, item.image_base64);
      }
      setBulkItems([{ id: "1", name: "", category: "ANA YEMEK", price: "180", image_url: null, image_base64: null }]);
      setActiveTab("POOL");
      fetchMenu();
    } catch (error) {
      console.error("Save bulk error:", error);
      alert("Yemekler eklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Skip header row and map data
        const newItems = data.slice(1)
          .filter(row => row[0]) // Only rows with a name
          .map((row, idx) => ({
            id: `excel-${Date.now()}-${idx}`,
            name: String(row[0]),
            category: (String(row[1]).toUpperCase().replace(" ", "_")) as any || "ANA YEMEK",
            price: String(row[2] || "180"),
            image_url: null,
            image_base64: null
          }));

        if (newItems.length === 0) {
          alert("Dosyada geçerli yemek verisi bulunamadı.");
        } else {
          setBulkItems(newItems);
          alert(`${newItems.length} yemek dosyadan okundu. Şimdi kontrol edip "Hepsini Havuza Kaydet" butonuna basabilirsiniz.`);
        }
      } catch (err) {
        console.error("Excel import error:", err);
        alert("Dosya okunurken bir hata oluştu. Lütfen formatı kontrol edin.");
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws_data = [
      ["Yemek Adı", "Kategori", "Fiyat"],
      ["Mercimek Çorbası", "ÇORBA", "120"],
      ["İzmir Köfte", "ANA YEMEK", "250"],
      ["Pilav", "YARDIMCI", "100"],
      ["Ayran", "İÇECEK", "40"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Yemek Listesi");
    XLSX.writeFile(wb, "yemek_listesi_taslak.xlsx");
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`${selectedIds.length} adet yemeği havuzdan tamamen silmek istediğinize emin misiniz?`)) {
      try {
        setLoading(true);
        for (const id of selectedIds) {
          await menuService.deleteMenuItem(id);
        }
        setSelectedIds([]);
        fetchMenu();
      } catch (error) {
        console.error("Bulk delete error:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkPriceUpdate = async () => {
    const percent = prompt("Seçili yemeklerin fiyatını yüzde kaç artırmak istersiniz? (Örn: 10)");
    if (!percent || isNaN(Number(percent))) return;

    try {
      setLoading(true);
      const ratio = 1 + (Number(percent) / 100);
      for (const id of selectedIds) {
        const item = menu.find(i => i.id === id);
        if (item) {
          const newPrice = Math.round(item.price * ratio);
          await menuService.updateMenuItem(id, { ...item, price: newPrice });
        }
      }
      setSelectedIds([]);
      fetchMenu();
      alert("Fiyatlar güncellendi!");
    } catch (error) {
      console.error("Bulk price update error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item: any) => {
    setEditingItem({ ...item });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.name) return;
    try {
      setProcessing(true);
      await menuService.updateMenuItem(editingItem.id, {
        name: editingItem.name,
        category: editingItem.category,
        price: Number(editingItem.price),
        image_url: editingItem.image_url
      });
      setEditModalVisible(false);
      setEditingItem(null);
      fetchMenu();
    } catch (error) {
      console.error("Update error:", error);
      alert("Güncelleme yapılamadı.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const newItems = [...bulkItems];
      newItems[index].image_url = reader.result as string; 
      newItems[index].image_base64 = base64;
      setBulkItems(newItems);
    };
    reader.readAsDataURL(file);
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayMenu = filteredMenu.filter(item => ["draft", "active", "sold_out"].includes(item.status));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Menü Yönetimi</h1>
          <p className="text-slate-500 mt-1">Günün menüsünü ve yemek havuzunu buradan yönetin.</p>
        </div>
        
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
          <button 
            onClick={() => setActiveTab("ADD")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ADD' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Yeni Yemek Ekle
          </button>
          <button 
            onClick={() => setActiveTab("POOL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'POOL' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Yemek Havuzu
          </button>
          <button 
            onClick={() => setActiveTab("TODAY")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'TODAY' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Günün Menüsü
          </button>
          <button 
            onClick={() => setActiveTab("FIXED")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'FIXED' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Sabit Fiyat Listesi
          </button>
        </div>
      </div>

      {loading && activeTab !== "ADD" ? (
        <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto" />
            <p className="text-slate-400 mt-4 font-medium italic">Yemekler yükleniyor...</p>
        </div>
      ) : (
        <>
          {activeTab === "TODAY" && (
            <div className="space-y-6">
              {todayMenu.some(i => i.status === 'draft') && (
                <div className="bg-accent/5 border border-accent/20 p-6 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-accent/20 p-3 rounded-2xl text-accent">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Yayınlanmamış Değişiklikler Var!</h3>
                      <p className="text-sm text-slate-600">Taslak halindeki yemekler müşterilere henüz görünmüyor.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handlePublish}
                    className="bg-accent text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2"
                  >
                    <span>YAYINLA & BİLDİRİM GÖNDER</span>
                  </button>
                </div>
              )}

              <div className="space-y-12">
                {todayMenu.length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                      <Utensils className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Günün Menüsü Boş</p>
                      <button onClick={() => setActiveTab("POOL")} className="text-accent underline font-bold mt-2 hover:text-accent/80">Havuzdan ekleyin</button>
                  </div>
                ) : (
                  CATEGORIES.map(cat => {
                    const items = todayMenu.filter(i => i.category === cat.id);
                    if (items.length === 0) return null;

                    return (
                      <div key={cat.id} className="space-y-6">
                        <div className="flex items-center space-x-4">
                           <div className="bg-accent/10 p-2 rounded-xl text-accent">
                              <cat.icon size={20} />
                           </div>
                           <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{cat.label}</h2>
                           <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {items.map(item => (
                            <div key={item.id} className={`bg-white rounded-[32px] p-7 border transition-all shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 flex flex-col justify-between ${item.status === 'sold_out' ? 'opacity-50 grayscale bg-slate-50 border-slate-200' : 'border-slate-100'}`}>
                              <div>
                                <div className="flex items-start justify-between mb-6">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-[24px] flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                      {item.image_url ? (
                                        <img src={item.image_url} className="w-full h-full object-cover" />
                                      ) : (
                                        <ImageIcon size={28} className="text-slate-300" />
                                      )}
                                    </div>
                                    <div>
                                       <span className="text-[10px] font-black text-accent uppercase tracking-widest bg-accent/5 px-2 py-0.5 rounded-lg border border-accent/10">{item.category}</span>
                                       <h3 className="text-xl font-bold text-slate-800 leading-tight mt-1">{item.name}</h3>
                                       <div className="flex items-center space-x-2 mt-2">
                                          {item.status === 'draft' && <span className="text-[9px] text-[#f59e0b] font-black uppercase tracking-widest">(YAYIN BEKLİYOR)</span>}
                                          {item.status === 'sold_out' && <span className="text-[9px] text-[#ef4444] font-black uppercase tracking-widest">(TÜKENDİ)</span>}
                                          {item.status === 'active' && <span className="text-[9px] text-[#10b981] font-black uppercase tracking-widest">(AKTİF)</span>}
                                       </div>
                                    </div>
                                  </div>
                                  <button onClick={() => handleDelete(item.id)} title="Havuzdan Tamamen Sil" className="p-2.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                     <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 pt-6 border-t border-slate-100 flex flex-col space-y-3">
                                 <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FİYAT</span>
                                    <span className="text-lg font-black text-slate-900 italic">₺{item.price}</span>
                                 </div>
                                 
                                 <div className="flex flex-wrap gap-2">
                                   <button 
                                     onClick={() => handleToggleStatus(item.id, "passive")}
                                     className="flex-1 min-w-[120px] flex items-center justify-center space-x-2 px-4 py-3 bg-white text-[#f59e0b] border-2 border-[#f59e0b] rounded-2xl text-[10px] font-black hover:bg-[#f59e0b] hover:text-white transition-all uppercase"
                                   >
                                      <span>Menüden Kaldır</span>
                                   </button>

                                   {item.status !== 'sold_out' ? (
                                     <button 
                                       onClick={() => handleToggleStatus(item.id, "sold_out")}
                                       className="flex-[1.5] min-w-[150px] flex items-center justify-center space-x-2 px-4 py-3 bg-[#ef4444] text-white rounded-2xl text-[10px] font-black hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-red-200 uppercase"
                                     >
                                        <Ban size={14} />
                                        <span>Tükendi Olarak İşaretle</span>
                                     </button>
                                   ) : (
                                     <button 
                                       onClick={() => handleToggleStatus(item.id, "active")}
                                       className="flex-[1.5] min-width-[150px] flex items-center justify-center space-x-2 px-4 py-3 bg-[#10b981] text-white rounded-2xl text-[10px] font-black hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-200 uppercase"
                                     >
                                        <Check size={14} />
                                        <span>Tekrar Satışa Aç</span>
                                     </button>
                                   )}
                                   <button 
                                     onClick={() => handleEditClick(item)}
                                     className="flex-1 min-w-[100px] py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black hover:bg-slate-100 transition-all uppercase border border-slate-200"
                                   >
                                      Düzenle
                                   </button>
                                 </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === "POOL" && (
            <div className="space-y-8">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative max-w-md w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        type="text"
                        placeholder="Havuzda yemek ara..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent shadow-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>

                  {selectedIds.length > 0 && (
                    <div className="flex items-center space-x-2 animate-in fade-in zoom-in duration-300">
                      <button 
                        onClick={handleBulkPriceUpdate}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all"
                      >
                        Fiyat Güncelle ({selectedIds.length})
                      </button>
                      <button 
                        onClick={handleBulkDelete}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-xs hover:bg-red-100 transition-all"
                      >
                        Seçilenleri Sil
                      </button>
                    </div>
                  )}
               </div>

               <div className="space-y-12">
                 {CATEGORIES.map(cat => {
                   const items = filteredMenu.filter(i => i.category === cat.id && i.status === 'passive');
                   if (items.length === 0) return null;

                   return (
                     <div key={cat.id} className="space-y-4">
                        <div className="flex items-center space-x-4">
                           <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
                              <cat.icon size={20} />
                           </div>
                           <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{cat.label}</h2>
                           <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {items.map(item => (
                             <div key={item.id} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col justify-between">
                                <div className="flex items-start space-x-4 mb-6">
                                   <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-[18px] shrink-0 overflow-hidden">
                                      {item.image_url ? (
                                        <img src={item.image_url} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                                          <ImageIcon size={20} />
                                        </div>
                                      )}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <h3 className="text-base font-bold text-slate-800 truncate">{item.name}</h3>
                                      <div className="text-sm font-black text-slate-400 italic mt-1">₺{item.price}</div>
                                   </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                   <button 
                                     onClick={() => handleToggleStatus(item.id, "draft")}
                                     className="flex-1 py-3 bg-accent text-white rounded-2xl text-[10px] font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20 uppercase"
                                   >
                                      Günün Menüsüne Ekle
                                   </button>
                                   <button 
                                     onClick={() => handleEditClick(item)}
                                     className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-accent transition-all border border-slate-100"
                                   >
                                      <Plus size={18} className="rotate-45" />
                                   </button>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                   );
                 })}

                 {filteredMenu.filter(i => i.status === 'passive').length === 0 && (
                   <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Havuzda uygun yemek bulunamadı.</p>
                   </div>
                 )}
               </div>
            </div>
          )}

          {activeTab === "ADD" && (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/40 border-t-8 border-t-accent">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 italic">Hızlı Toplu Yemek Ekleme</h2>
                        <p className="text-slate-500 mt-1 font-medium">Havuzunuza çok sayıda yemeği aynı anda kaydedebilirsiniz.</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={downloadTemplate}
                          className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all"
                        >
                          <FileDown size={16} />
                          <span>TASLAK İNDİR</span>
                        </button>
                        <label className="flex items-center space-x-2 px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded-xl font-bold text-xs hover:bg-accent/20 cursor-pointer transition-all">
                          <Upload size={16} />
                          <span>{isImporting ? 'OKUNUYOR...' : 'EXCEL YÜKLE'}</span>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".xlsx, .xls, .csv"
                            onChange={handleImportExcel}
                            disabled={isImporting}
                          />
                        </label>
                      </div>
                   </div>

                  <div className="space-y-4">
                    {bulkItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-[48px_80px_1fr_180px_120px_48px] items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-3xl group animate-in slide-in-from-top-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black text-xs shrink-0">
                          {index + 1}
                        </div>
                        
                        {/* Image Upload */}
                        <div className="relative group/img">
                           <div className="w-16 h-16 bg-white border border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon size={20} className="text-slate-300" />
                              )}
                           </div>
                           <label className="absolute inset-0 cursor-pointer opacity-0 group-hover/img:opacity-100 transition-opacity bg-accent/60 flex items-center justify-center text-white rounded-2xl">
                              <Plus size={20} />
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleBulkImageChange(index, e)}
                              />
                           </label>
                        </div>

                        <input 
                          type="text"
                          placeholder="Yemek Adı"
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent/20 outline-none font-bold text-slate-700"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...bulkItems];
                            newItems[index].name = e.target.value;
                            setBulkItems(newItems);
                          }}
                        />

                        <select 
                          className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent/20 outline-none font-bold cursor-pointer text-slate-600"
                          value={item.category}
                          onChange={(e) => {
                            const newItems = [...bulkItems];
                            newItems[index].category = e.target.value;
                            setBulkItems(newItems);
                          }}
                        >
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>

                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
                           <input 
                            type="number"
                            placeholder="Fiyat"
                            className="w-full bg-white border border-slate-200 pl-8 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-accent/20 outline-none font-bold text-slate-700"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...bulkItems];
                              newItems[index].price = e.target.value;
                              setBulkItems(newItems);
                            }}
                          />
                        </div>

                        <button 
                          onClick={() => setBulkItems(bulkItems.filter(i => i.id !== item.id))}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                      onClick={handleAddBulkRow}
                      className="w-full sm:w-auto px-10 py-5 bg-slate-100 text-slate-700 rounded-[24px] font-bold flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all text-sm"
                    >
                      <Plus size={22} />
                      <span>YENİ SATIR EKLE</span>
                    </button>
                    <button 
                      onClick={handleSaveBulk}
                      className="w-full sm:w-auto min-w-[280px] px-12 py-5 bg-accent text-white rounded-[24px] font-black flex items-center justify-center space-x-3 shadow-xl shadow-accent/20 hover:scale-[1.05] active:scale-95 transition-all"
                    >
                      <Save size={22} />
                      <span>HEPSİNİ HAVUZA KAYDET</span>
                    </button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === "FIXED" && (
            <div className="space-y-6">
                <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200/50">
                   <h3 className="text-slate-800 font-bold mb-2">Sabit Fiyat Bilgilendirmesi</h3>
                   <p className="text-slate-600 text-sm italic">Bu alandaki fiyatlar işletmenizin fiziki tabelasındaki fiyatları temsil eder. Müşteri fiyatları buradan beslenmektedir.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {systemPrices.map(item => (
                     <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-accent/30 transition-all group">
                        <div className="flex items-center space-x-4">
                           <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                              <Star size={24} />
                           </div>
                           <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</div>
                              <h4 className="text-lg font-bold text-slate-800">{item.name}</h4>
                           </div>
                        </div>
                        <div className="flex items-center space-x-4">
                           <div className="text-xl font-black text-slate-900 italic">₺{item.price}</div>
                           <button 
                             onClick={() => handleEditClick(item)}
                             className="p-3 text-slate-300 hover:text-accent hover:bg-accent/5 rounded-2xl transition-all"
                           >
                              <Plus size={20} />
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
            </div>
          )}

          {/* Edit Modal */}
          {editModalVisible && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl animate-in zoom-in duration-300">
                  <h2 className="text-2xl font-black text-slate-900 italic mb-2">Öğeyi Düzenle</h2>
                  <p className="text-slate-500 text-sm mb-8">İsim ve fiyat bilgilerini güncelleyin.</p>

                  <div className="space-y-6">
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">AD / BAŞLIK</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none font-bold text-slate-800"
                          value={editingItem.name}
                          onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                        />
                     </div>

                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">FİYAT (₺)</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none font-bold text-slate-800"
                          value={editingItem.price}
                          onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                        />
                     </div>

                     <div className="flex gap-4 pt-4">
                        <button 
                          onClick={() => setEditModalVisible(false)}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                        >
                           İPTAL
                        </button>
                        <button 
                          onClick={handleSaveEdit}
                          disabled={processing}
                          className="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center"
                        >
                           {processing ? <Loader2 className="animate-spin" size={20} /> : 'GÜNCELLEMEYİ KAYDET'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
