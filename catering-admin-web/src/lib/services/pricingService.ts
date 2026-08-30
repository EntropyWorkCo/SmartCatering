import { supabase } from "../supabase";

export type MealPrice = {
  id?: string;
  company_id: string;
  selection_count: 2 | 3 | 4;
  unit_price: number;
  updated_at?: string;
};

export const pricingService = {
  /** Bir firmanın tüm tabldot fiyatlarını getirir */
  async getCompanyPrices(companyId: string): Promise<MealPrice[]> {
    const { data, error } = await (supabase as any)
      .from("company_meal_prices")
      .select("*")
      .eq("company_id", companyId)
      .order("selection_count", { ascending: true });

    if (error) {
      console.error("getCompanyPrices error:", error);
      return [];
    }
    return (data || []) as MealPrice[];
  },

  /** Tek bir tabldot türünün fiyatını getirir (yoksa 0) */
  async getUnitPrice(companyId: string, selectionCount: 2 | 3 | 4): Promise<number> {
    const { data, error } = await (supabase as any)
      .from("company_meal_prices")
      .select("unit_price")
      .eq("company_id", companyId)
      .eq("selection_count", selectionCount)
      .maybeSingle();

    if (error || !data) return 0;
    return (data as any).unit_price ?? 0;
  },

  /**
   * Fiyatı upsert eder (yoksa ekle, varsa güncelle).
   * Admin tarafından çağrılır.
   */
  async setPrice(
    companyId: string,
    selectionCount: 2 | 3 | 4,
    unitPrice: number
  ): Promise<void> {
    const { error } = await (supabase as any)
      .from("company_meal_prices")
      .upsert(
        {
          company_id: companyId,
          selection_count: selectionCount,
          unit_price: unitPrice,
        },
        { onConflict: "company_id,selection_count" }
      );

    if (error) {
      console.error("setPrice error:", error);
      throw error;
    }
  },

  /**
   * Birden fazla fiyatı tek seferde upsert eder.
   * Admin "Fiyatları Kaydet" butonunda kullanılır.
   */
  async setPrices(
    companyId: string,
    prices: { selectionCount: 2 | 3 | 4; unitPrice: number }[]
  ): Promise<void> {
    const rows = prices.map((p) => ({
      company_id: companyId,
      selection_count: p.selectionCount,
      unit_price: p.unitPrice,
    }));

    const { error } = await (supabase as any)
      .from("company_meal_prices")
      .upsert(rows, { onConflict: "company_id,selection_count" });

    if (error) {
      console.error("setPrices error:", error);
      throw error;
    }
  },

  /**
   * Siparişlerdeki tabldot sayılarını sayarak firmanın toplam faturasını hesaplar.
   * Fiyat girilmemiş tabldot türleri için 0 kullanılır.
   * @returns { total, breakdown } — breakdown: hangi tabldot türünden kaç adet × fiyat
   */
  async calculateMonthlyTotal(
    companyId: string,
    orders: any[],
    priceOverrides?: MealPrice[]
  ): Promise<{
    total: number;
    breakdown: { selectionCount: number; count: number; unitPrice: number; subtotal: number }[];
  }> {
    // Fiyatları al (override yoksa DB'den çek)
    const prices = priceOverrides ?? (await pricingService.getCompanyPrices(companyId));
    const priceMap: Record<number, number> = {};
    prices.forEach((p) => { priceMap[p.selection_count] = p.unit_price; });

    // Sadece yemek siparişleri
    const mealOrders = orders.filter(
      (o: any) => o.order_type === "Şimdi Ye" || o.order_type === "Sipariş Ver"
    );

    // Tabldot türüne göre say — her siparişin TÜM kalemlerini tara
    const countMap: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    mealOrders.forEach((order: any) => {
      const items: any[] = order.adisyon_items || [];

      items.forEach((i: any) => {
        // 1. Selections-based (menu ekranı) — selections dizisinin uzunluğu tabldot türünü verir
        if (Array.isArray(i.selections) && i.selections.length >= 2) {
          const sc = i.selections.length <= 4 ? i.selections.length : 4;
          countMap[sc] += (i.quantity || 1);
          return;
        }

        // 2. Name/category-based (home ekranı veya manuel) — TABLDOT içeren isimden türü çıkar
        const cat: string = i.menu_items?.category || '';
        const nm: string = i.menu_items?.name || '';
        if (cat === 'TABLDOT' || nm.includes('TABLDOT') || nm.includes('PAKET')) {
          let sc = 4;
          if (nm.includes('2') || nm.toUpperCase().includes('2 ÇEŞİT') || nm.toUpperCase().includes('IKI') || nm.toUpperCase().includes('İKİ')) sc = 2;
          else if (nm.includes('3') || nm.toUpperCase().includes('3 ÇEŞİT') || nm.toUpperCase().includes('ÜÇ') || nm.toUpperCase().includes('UC')) sc = 3;
          countMap[sc] += (i.quantity || 1);
        }
      });
    });

    const breakdown = ([2, 3, 4] as const).map((sc) => ({
      selectionCount: sc,
      count: countMap[sc],
      unitPrice: priceMap[sc] ?? 0,
      subtotal: countMap[sc] * (priceMap[sc] ?? 0),
    }));

    const total = breakdown.reduce((s, b) => s + b.subtotal, 0);
    return { total, breakdown };
  },
};
