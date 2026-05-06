import { supabase } from "../supabase";

export const billingService = {
  /**
   * Şirket için manuel borç veya ödeme kaydı oluşturur.
   * "adisyon" tablosunu kullanarak kayıt atar.
   */
  async addManualEntry(userId: string, amount: number, startDate: string, endDate: string, type: 'DEBT' | 'PAYMENT') {
    const { error } = await supabase
      .from("adisyon")
      .insert([
        { 
          user_id: userId, 
          total_amount: amount, 
          status: type === 'DEBT' ? 'PENDING' : 'PAID', 
          order_type: type === 'DEBT' ? 'MANUAL_DEBT' : 'MANUAL_PAYMENT', 
          note: `${startDate} - ${endDate}`,
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
   * Parçalı ödeme kaydı oluşturur ve bakiyeyi günceller.
   */
  async recordPayment(userId: string, companyId: string | null, amount: number, method: string, description: string) {
    // 1. Ödemeyi 'payments' tablosuna kaydet
    const { error: paymentError } = await supabase
      .from("payments")
      .insert([
        {
          user_id: userId,
          company_id: companyId,
          amount: amount,
          payment_method: method,
          description: description,
          created_at: new Date().toISOString()
        }
      ]);

    if (paymentError) throw paymentError;

    // 2. Eğer kurumsal bir müşteri ise şirket bakiyesini güncelle
    if (companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      const currentBalance = company?.balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);

      await this.updateCompanyBalance(companyId, newBalance);
    } else {
      // Bireysel müşteri ise mevcut sisteme uyum sağlamak için 
      // pozitif tutarlı bir 'MANUAL_PAYMENT' adisyonu ekle
      // Uygulama (home.tsx) bu tipi görünce borçtan çıkaracaktır.
      await supabase.from("adisyon").insert([{
        user_id: userId,
        total_amount: amount, 
        status: 'PENDING',
        order_type: 'MANUAL_PAYMENT',
        note: `Kısmi Ödeme: ${description}`,
        created_at: new Date().toISOString()
      }]);
    }
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
