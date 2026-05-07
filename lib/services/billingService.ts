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
  }
};
