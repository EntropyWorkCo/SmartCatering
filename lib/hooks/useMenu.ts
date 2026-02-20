import { useEffect, useState } from "react";
import { getMenu } from "../services/menuService";

export const useMenu = () => {
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMenu().then((data) => {
      setMenu(data);
      setLoading(false);
    });
  }, []);

  return { menu, loading };
};
