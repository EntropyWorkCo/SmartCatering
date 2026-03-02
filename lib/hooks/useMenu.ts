import { useEffect, useState } from "react";
import { menuService } from "../services/menuService";

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
  }, [onlyActive]);

  return { menu, systemPrices, loading, refetch: fetchMenu };
};
