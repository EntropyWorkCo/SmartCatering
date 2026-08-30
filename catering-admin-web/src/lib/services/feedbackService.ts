import { supabase } from "../supabase";

export const feedbackService = {
  // Yeni bir değerlendirme gönder
  async submitFeedback(userId: string, rating: number, comment?: string) {
    const { data, error } = await supabase
      .from("feedbacks")
      .insert([{ user_id: userId, rating, note: comment }])
      .select();

    if (error) throw error;
    return data;
  },

  // (Admin için) Tüm geri bildirimleri yorum yapan kişinin adıyla birlikte getir
  async getAllFeedbacks() {
    const { data, error } = await supabase
      .from("feedbacks")
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
