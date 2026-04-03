import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// web tarafında polyfill'e gerek yok
if (Platform.OS !== 'web') {
  require("react-native-url-polyfill/auto");
}
// 1. Ürettiğimiz tipleri içeri aktar
import { Database } from "./types/database.types";

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE"; // Ekrandaki uzun keyin aynen kalsın

const CustomStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return Promise.resolve(null);
    if (Platform.OS === 'web') {
      return Promise.resolve(window.localStorage.getItem(key));
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return Promise.resolve();
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return Promise.resolve();
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

// 2. createClient fonksiyonuna <Database> tipini ekle
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: CustomStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
