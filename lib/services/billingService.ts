import { supabase } from "../supabase";

export const billingService = {
  /**
   * Şirket için manuel borç veya ödeme kaydı oluşturur.
   * "adisyon" tablosunu kullanarak kayıt atar.
   */
  async addManualEntry(userId: string, amount: number, startDate: string, endDate: string, type: 'DEBT' | 'PAYMENT', customNote?: string) {
    const { error } = await supabase
      .from("adisyon")
      .insert([
        { 
          user_id: userId, 
          total_amount: amount, 
          status: 'PENDING', 
          order_type: type === 'DEBT' ? 'MANUAL_DEBT' : 'MANUAL_PAYMENT', 
          note: customNote || `${startDate} - ${endDate}`,
          created_at: new Date().toISOString()
        },
      ]);

    if (error) throw error;
  },

  /**
   * Şirketin manuel girilmiş borç ve ödeme geçmişini getirir.
   */
  async getManualEntries(userId: string) {
    const { data, error } = await supabase
      .from("adisyon")
      .select("*")
      .eq("user_id", userId)
      .in("order_type", ["MANUAL_DEBT", "MANUAL_PAYMENT"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Şirketin borcunu (bakiyesini) manuel olarak günceller.
   * @param companyId Şirketin ID'si
   * @param balance Yeni bakiye tutarı
   */
  async updateCompanyBalance(companyId: string, balance: number) {
    const { error } = await supabase
      .from("companies")
      .update({
        balance: balance,
        last_debt_update: new Date().toISOString()
      })
      .eq("id", companyId);

    if (error) throw error;
  },

  /**
   * Şirketin ödeme yaptığını onaylar (bakiyeyi sıfırlar veya düşer).
   * @param companyId Şirket ID
   */
  async clearCompanyBalance(companyId: string) {
    const { error } = await supabase
      .from("companies")
      .update({
        balance: 0,
        last_debt_update: new Date().toISOString()
      })
      .eq("id", companyId);

    if (error) throw error;
  },

  /**
   * Belirli bir kullanıcının (şirket veya bireysel) güncel bakiyesini çeker.
   */
  async getUserBalance(userId: string) {
    // 1. Önce şirket bakiyesi var mı bak
    const { data: company } = await supabase
      .from("companies")
      .select("balance")
      .eq("user_id", userId)
      .single();
    
    if (company) return company.balance || 0;

    // 2. Şirket değilse adisyonlardan hesapla
    const { data: orders } = await supabase
      .from("adisyon")
      .select("total_amount, status, order_type")
      .eq("user_id", userId);
    
    if (!orders) return 0;

    return orders.reduce((acc, curr) => {
      const status = (curr.status || "").toUpperCase();
      if (["CANCELLED", "İPTAL", "PAID", "ÖDENDI", "ÖDENDİ"].includes(status)) return acc;
      
      if (curr.order_type === 'MANUAL_PAYMENT') {
        return acc - (curr.total_amount || 0);
      }
      return acc + (curr.total_amount || 0);
    }, 0);
  },

  /**
   * Ödeme kaydı oluşturur ve bakiyeyi günceller.
   */
  async recordPayment(userId: string, companyId: string | null, amount: number, method: string, description: string) {
    // 1. Ödemeyi 'adisyon' tablosuna kaydet (Geçmiş döküm için)
    await this.addManualEntry(
      userId, 
      amount, 
      new Date().toLocaleDateString('tr-TR'), 
      new Date().toLocaleDateString('tr-TR'), 
      'PAYMENT',
      `Kısmi Ödeme: ${description}${method ? ` (${method})` : ''}`
    );

    // 2. Bakiyeyi güncelle
    if (companyId) {
      // Kurumsal ise bakiye düşür
      const { data: company } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      const currentBalance = company?.balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);
      await this.updateCompanyBalance(companyId, newBalance);
    }
  },

  /**
   * Ay kapanışı: Tüm çalışanların o aya ait siparişlerini PAID yapar,
   * companies.balance = 0 sıfırlar ve kapanış notu düşer.
   */
  async closeMonth(companyId: string, companyUserId: string, employeeIds: string[]) {
    const now = new Date();
    const monthName = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const allUserIds = [...employeeIds, companyUserId].filter(Boolean);

    if (allUserIds.length === 0) return;

    // 1. O ay ve öncesine ait tüm bekleyen siparişleri PAID yap
    // Manuel borç/ödeme kayıtlarına (MANUAL_DEBT/MANUAL_PAYMENT) dokunma
    const { error: updateError } = await supabase
      .from("adisyon")
      .update({ status: "PAID", paid_at: now.toISOString() })
      .in("user_id", allUserIds)
      .not("status", "in", '("CANCELLED","İptal","PAID","Ödendi","ÖDENDİ")')
      .not("order_type", "in", '("MANUAL_PAYMENT","MANUAL_DEBT")');

    if (updateError) throw updateError;

    // 2. Şirket bakiyesini sıfırla
    await supabase
      .from("companies")
      .update({ balance: 0, last_debt_update: now.toISOString() })
      .eq("id", companyId);

    // 3. Kapanış kaydı düş (geçmişte görünsün diye MANUAL_DEBT ile)
    await supabase
      .from("adisyon")
      .insert({
        user_id: companyUserId,
        total_amount: 0,
        status: "PAID",
        order_type: "MANUAL_DEBT",
        note: `✅ Ay Kapanışı Onaylandı: ${monthName}`,
        created_at: now.toISOString(),
        paid_at: now.toISOString(),
      });
  },

  /**
   * Belirli bir kullanıcının (şirketin) güncel bakiyesini çeker.
   */
  async getCompanyBalance(userId: string) {
    const { data, error } = await supabase
      .from("companies")
      .select("balance, last_debt_update")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Admin Ay Kapanışı — Seçilen ay için tüm firmaların bekleyen
   * siparişlerini PAID olarak işaretler.
   * MANUAL_PAYMENT ve MANUAL_DEBT kayıtlarına dokunmaz.
   * @returns { affectedOrders, totalAmount, affectedFirms }
   */
  async closeMonthAdmin(
    year: number,
    month: number
  ): Promise<{ affectedOrders: number; totalAmount: number; affectedFirms: number }> {
    // Ayın başı ve sonu (UTC)
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const CLOSED_STATUSES = '("PAID","Ödendi","ÖDENDİ","CANCELLED","İptal","COMPLETED","Tamamlandı")';
    const EXCLUDED_TYPES  = '("MANUAL_PAYMENT","MANUAL_DEBT")';

    // 1. Özet — kaç sipariş, ne kadar tutar
    const { data: summary, error: summaryErr } = await supabase
      .from("adisyon")
      .select("id, total_amount, user_id")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .not("status", "in", CLOSED_STATUSES)
      .not("order_type", "in", EXCLUDED_TYPES);

    if (summaryErr) throw summaryErr;

    const affectedOrders = summary?.length ?? 0;
    const totalAmount    = summary?.reduce((s, o) => s + (o.total_amount || 0), 0) ?? 0;

    // Kaç farklı firma etkileniyor (user_id bazında companies sorgusu)
    const uniqueUserIds = [...new Set((summary || []).map((o) => o.user_id))];
    const { data: companyData } = await supabase
      .from("companies")
      .select("id")
      .in("user_id", uniqueUserIds.length > 0 ? uniqueUserIds : ["__none__"]);
    const affectedFirms = companyData?.length ?? 0;

    if (affectedOrders === 0) return { affectedOrders: 0, totalAmount: 0, affectedFirms: 0 };

    // 2. Güncelle — PAID yap
    const { error: updateErr } = await supabase
      .from("adisyon")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .not("status", "in", CLOSED_STATUSES)
      .not("order_type", "in", EXCLUDED_TYPES);

    if (updateErr) throw updateErr;

    // 3. Tüm etkilenen firmaların bakiyesini sıfırla
    if (companyData && companyData.length > 0) {
      await supabase
        .from("companies")
        .update({ balance: 0, last_debt_update: new Date().toISOString() })
        .in("id", companyData.map((c) => c.id));
    }

    return { affectedOrders, totalAmount, affectedFirms };
  },
};
