import { supabase } from "../supabase";

export const feedbackService = {
  // Yeni bir değerlendirme gönder
  async submitFeedback(userId: string, rating: number, comment?: string) {
    const { data, error } = await supabase
      .from("feedback")
      .insert([{ user_id: userId, rating, comment }])
      .select();

    if (error) throw error;
    return data;
  },

  // (Admin için) Tüm geri bildirimleri yorum yapan kişinin adıyla birlikte getir
  async getAllFeedbacks() {
    const { data, error } = await supabase
      .from("feedback")
      // Foreign key ile users tablosuna bağlanıp full_name bilgisini de çekiyoruz
      .select(
        `
        *,
        users ( full_name )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
};
