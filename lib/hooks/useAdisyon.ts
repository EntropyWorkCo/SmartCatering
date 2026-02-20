import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function useAdisyon() {
  const [adisyonlar, setAdisyonlar] = useState([]);

  async function fetchAdisyonlar() {
    const { data, error } = await supabase
      .from("adisyon")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setAdisyonlar(data);
    else console.log("FETCH ERROR", error);
  }

  async function createAdisyon(values: { total_amount: number }) {
    const { error } = await supabase.from("adisyon").insert({
      total_amount: values.total_amount,
    });

    if (!error) fetchAdisyonlar();
    else console.log("INSERT ERROR", error);
  }

  useEffect(() => {
    fetchAdisyonlar();
  }, []);

  return { adisyonlar, createAdisyon };
}
