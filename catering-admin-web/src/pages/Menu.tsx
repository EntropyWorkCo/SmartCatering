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
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  PlusCircle,
  Image as ImageIcon,
  FileDown,
  Upload,
  CheckSquare,
  Square
} from "lucide-react";
import * as XLSX from "xlsx";
import { menuService } from "../lib/services/menuService";

const CATEGORIES = [
  { id: "ANA YEMEK", label: "Ana Yemek", icon: Utensils },
  { id: "YARDIMCI", label: "Yardımcı", icon: Star },
  { id: "ÇORBA", label: "Çorba", icon: Soup },
  { id: "EKSTRA", label: "Ekstra", icon: PlusCircle },
  { id: "İÇECEK", label: "İçecek", icon: Coffee },
];

export default function MenuManagement() {
  const [activeTab, setActiveTab] = useState<"TODAY" | "POOL" | "ADD">("TODAY");
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Bulk Add State
  const [bulkItems, setBulkItems] = useState([
    { id: "1", name: "", category: "ANA YEMEK", price: "180" }
  ]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const data = await menuService.getAllMenu();
      setMenu(data || []);
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
    setBulkItems([...bulkItems, { id: Date.now().toString(), name: "", category: "ANA YEMEK", price: "180" }]);
  };

  const handleSaveBulk = async () => {
    const validItems = bulkItems.filter(i => i.name.trim() !== "");
    if (validItems.length === 0) return alert("Lütfen en az bir yemek adı girin.");

    try {
      setLoading(true);
      for (const item of validItems) {
        await menuService.addMenuItem(item.name, item.category, Number(item.price));
      }
      setBulkItems([{ id: "1", name: "", category: "ANA YEMEK", price: "180" }]);
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
            price: String(row[2] || "180")
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

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMenu.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMenu.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayMenu = filteredMenu.filter(item => ["draft", "active", "sold_out"].includes(item.status));
  const poolMenu = filteredMenu;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Menü Yönetimi</h1>
          <p className="text-slate-500 mt-1">Günün menüsünü ve yemek havuzunu buradan yönetin.</p>
        </div>
        
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab("TODAY")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'TODAY' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Günün Menüsü
          </button>
          <button 
            onClick={() => setActiveTab("POOL")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'POOL' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Yemek Havuzu
          </button>
          <button 
            onClick={() => setActiveTab("ADD")}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ADD' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Hızlı Ekle
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {todayMenu.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                      <Utensils className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Günün Menüsü Boş</p>
                      <button onClick={() => setActiveTab("POOL")} className="text-accent underline font-bold mt-2 hover:text-accent/80">Havuzdan ekleyin</button>
                  </div>
                ) : (
                  todayMenu.map(item => (
                    <div key={item.id} className={`bg-white rounded-3xl p-6 border transition-all shadow-sm group hover:shadow-xl hover:shadow-slate-200/50 ${item.status === 'sold_out' ? 'opacity-60 grayscale' : 'border-slate-100'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4">
                           <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                              {item.image_url ? (
                                <img src={item.image_url} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon size={24} className="text-slate-300" />
                              )}
                           </div>
                           <div>
                              <span className="text-[10px] font-black text-accent uppercase tracking-widest">{item.category}</span>
                              <h3 className="text-lg font-bold text-slate-800 leading-tight">{item.name}</h3>
                              {item.status === 'draft' && <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold ml-0 mt-1 inline-block">TASLAK</span>}
                              {item.status === 'sold_out' && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold ml-0 mt-1 inline-block uppercase italic">Tükendi</span>}
                           </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                           <button onClick={() => handleToggleStatus(item.id, "passive")} title="Menüden Kaldır" className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><X size={18} /></button>
                           {item.status !== 'sold_out' && <button onClick={() => handleToggleStatus(item.id, "sold_out")} title="Tükendi İşaretle" className="p-2 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><AlertCircle size={18} /></button>}
                           {item.status === 'sold_out' && <button onClick={() => handleToggleStatus(item.id, "active")} title="Satışa Aç" className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"><CheckCircle2 size={18} /></button>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "POOL" && (
            <div className="space-y-6">
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

               <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-100">
                          <th className="px-6 py-5 w-10">
                            <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                              {selectedIds.length === filteredMenu.length ? <CheckSquare className="text-accent" size={18} /> : <Square size={18} />}
                            </button>
                          </th>
                          <th className="px-6 py-5">Kategori</th>
                          <th className="px-6 py-5">Yemek Adı</th>
                          <th className="px-6 py-5">Fiyat</th>
                          <th className="px-6 py-5">Durum</th>
                          <th className="px-6 py-5 text-right">Aksiyonlar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poolMenu.map(item => (
                          <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(item.id) ? 'bg-accent/5' : ''}`}>
                            <td className="px-6 py-5">
                              <button onClick={() => toggleSelect(item.id)} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                                {selectedIds.includes(item.id) ? <CheckSquare className="text-accent" size={18} /> : <Square size={18} />}
                              </button>
                            </td>
                            <td className="px-6 py-5">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                            </td>
                            <td className="px-6 py-5">
                               <span className="text-sm font-bold text-slate-800">{item.name}</span>
                            </td>
                            <td className="px-6 py-5">
                               <span className="text-sm font-bold text-slate-600">{item.price} ₺</span>
                            </td>
                            <td className="px-6 py-5">
                               {item.status === 'passive' ? (
                                 <span className="text-[10px] font-bold text-slate-400 italic">HAVUZDA</span>
                               ) : (
                                 <span className="text-[10px] font-bold text-accent italic uppercase tracking-tighter">GÜNÜN MENÜSÜNDE</span>
                               )}
                            </td>
                            <td className="px-6 py-5 text-right">
                               <div className="flex items-center justify-end space-x-3">
                                  {item.status === 'passive' ? (
                                    <button 
                                      onClick={() => handleToggleStatus(item.id, "draft")}
                                      className="text-xs font-black bg-accent text-white px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-accent/10"
                                    >
                                      GÜNÜN MENÜSÜNE EKLE
                                    </button>
                                  ) : (
                                    <button 
                                      disabled
                                      className="text-[11px] font-black text-slate-300 uppercase tracking-tight"
                                    >
                                      ZATEN EKLİ
                                    </button>
                                  )}
                                  <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                    <Trash2 size={18} />
                                  </button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                      <div key={item.id} className="flex flex-col md:flex-row items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group animate-in slide-in-from-top-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black text-xs">
                          {index + 1}
                        </div>
                        <input 
                          type="text"
                          placeholder="Yemek Adı (Örn: Dana Kavurma)"
                          className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent/20 outline-none font-bold"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...bulkItems];
                            newItems[index].name = e.target.value;
                            setBulkItems(newItems);
                          }}
                        />
                        <select 
                          className="w-full md:w-48 bg-white border border-slate-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent/20 outline-none font-bold cursor-pointer"
                          value={item.category}
                          onChange={(e) => {
                            const newItems = [...bulkItems];
                            newItems[index].category = e.target.value;
                            setBulkItems(newItems);
                          }}
                        >
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <button 
                          onClick={() => setBulkItems(bulkItems.filter(i => i.id !== item.id))}
                          className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col md:flex-row gap-4 items-center">
                    <button 
                      onClick={handleAddBulkRow}
                      className="w-full md:w-auto px-8 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all text-sm"
                    >
                      <Plus size={20} />
                      <span>YENİ SATIR EKLE</span>
                    </button>
                    <button 
                      onClick={handleSaveBulk}
                      className="w-full flex-1 md:flex-none px-12 py-4 bg-accent text-white rounded-2xl font-black flex items-center justify-center space-x-3 shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Save size={20} />
                      <span>HEPSİNİ HAVUZA KAYDET</span>
                    </button>
                  </div>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
