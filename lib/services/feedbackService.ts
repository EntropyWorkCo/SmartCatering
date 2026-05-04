import { supabase } from "../supabase";

export const feedbackService = {
  // Yeni bir sipariş değerlendirmesi gönder
  async submitFeedback(userId: string, rating: number, note?: string) {
    const { data, error } = await supabase
      .from("feedbacks")
      .insert([{ user_id: userId, rating, note }])
      .select();

    if (error) throw error;
    return data;
  },

  // Uygulama hakkında genel geri bildirim gönder (yıldız puanı olmadan)
  async submitAppFeedback(userId: string, note: string) {
    const { data, error } = await supabase
      .from("feedbacks")
      .insert([{ 
        user_id: userId, 
        note, 
        rating: null,
        type: 'app_feedback'
      }])
      .select();

    if (error) throw error;
    return data;
  },

  // (Admin için) Tüm geri bildirimleri yorum yapan kişinin adıyla birlikte getir
  async getAllFeedbacks() {
    const { data, error } = await supabase
      .from("feedbacks")
      .select(`
        *,
        users ( full_name )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
};
