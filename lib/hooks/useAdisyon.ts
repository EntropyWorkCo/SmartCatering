import { useEffect, useState } from "react";
import { adisyonService } from "../services/adisyonService";
import { supabase } from "../supabase";

export const useAdisyon = (userId?: string) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await adisyonService.getUserOrders(userId);
      setOrders(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Realtime Güncelleme Dinleyicisi
    if (userId) {
      const channel = supabase
        .channel("custom-update-channel")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "adisyon",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === payload.new.id
                  ? { ...order, status: payload.new.status }
                  : order,
              ),
            );
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  return {
    orders,
    loading,
    fetchOrders,
    createOrder: adisyonService.createOrder,
    updateOrderStatus: async (orderId: string, status: string) => {
      setLoading(true);
      try {
        await adisyonService.updateOrderStatus(orderId, status);
        await fetchOrders(); // refresh
      } catch (error) {
        console.error(error);
        throw error;
      } finally {
        setLoading(false);
      }
    }
  };
};
