import { useEffect, useState } from "react";
import { menuService } from "../services/menuService";
import { supabase } from "../supabase";

export const useMenu = (onlyActive: boolean = true) => {
  const [menu, setMenu] = useState<any[]>([]);
  const [systemPrices, setSystemPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const data = onlyActive ? await menuService.getActiveMenu() : await menuService.getAllMenu();
      const sysData = await menuService.getSystemPrices();
      setMenu(data || []);
      setSystemPrices(sysData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Benzersiz bir kanal adı oluştur, çünkü bu hook birden fazla yerde çağrılırsa aynı kanala 2 kere abone olmaya çalışıp hata verir.
    const channelName = `menu-items-changes-${Math.random().toString(36).substring(7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onlyActive]);

  return { menu, systemPrices, loading, refetch: fetchMenu };
};
