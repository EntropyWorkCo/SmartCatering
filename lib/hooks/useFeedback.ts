import { useState } from "react";
import { feedbackService } from "../services/feedbackService";

export const useFeedback = () => {
  const [loading, setLoading] = useState(false);

  const sendFeedback = async (
    userId: string,
    rating: number,
    comment?: string,
  ) => {
    setLoading(true);
    try {
      await feedbackService.submitFeedback(userId, rating, comment);
      return { success: true };
    } catch (error: any) {
      console.error("Geri bildirim gönderilemedi:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { sendFeedback, loading };
};
