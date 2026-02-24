import { useEffect, useState } from "react";
import { menuService } from "../services/menuService";

export const useMenu = () => {
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const data = await menuService.getActiveMenu();
      setMenu(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return { menu, loading, refetch: fetchMenu };
};
