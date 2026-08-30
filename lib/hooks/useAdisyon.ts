import { useEffect, useState } from "react";
import { adisyonService } from "../services/adisyonService";
import { supabase } from "../supabase";

export const useAdisyon = (userId?: string, onNewOrder?: (payload: any) => void) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    setOrders([]); // Eski verinin kısa süre görünmesini önle
    try {
      let data;
      if (userId) {
        data = await adisyonService.getUserOrders(userId);
      } else {
        // Admin mode - fetch all orders
        data = await adisyonService.getAllOrders();
      }
      setOrders(data || []);
    } catch (error) {
      console.error("🏁 fetchOrders ERROR:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Realtime Güncelleme Dinleyicisi
    let filterQuery: string | undefined = undefined;
    if (userId) {
      filterQuery = `user_id=eq.${userId}`;
    }

    const channelConf: any = {
      event: "*",
      schema: "public",
      table: "adisyon"
    };
    if (filterQuery) channelConf.filter = filterQuery;

    const baseName = userId ? `custom-update-channel-${userId}` : "custom-update-channel-admin";
    const channelName = `${baseName}-${Math.random().toString(36).substring(7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        channelConf,
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Yeni sipariş geldi → listeye ekle ve callback'i tetikle
            if (!userId && onNewOrder) {
              onNewOrder(payload.new);
            }
            fetchOrders(); // Yeni kayıt için join'li veri gerekiyor, fetch şart
          } else if (payload.eventType === 'UPDATE') {
            // Durum değişikliği → sadece o siparişi local state'te güncelle, DB'ye gitme
            const updatedOrder = payload.new as any;
            setOrders(prev =>
              prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
            );
          } else if (payload.eventType === 'DELETE') {
            // Silindi → listeden çıkar
            setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    orders,
    loading,
    fetchOrders,
// ... rest same
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
