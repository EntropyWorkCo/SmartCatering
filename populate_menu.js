const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MEYDAN_CORE_MENU = [
    { name: "ANA YEMEK", category: "ANA YEMEK", price: 180, is_active: true },
    { name: "YARDIMCI", category: "YARDIMCI", price: 90, is_active: true },
    { name: "ÇORBA ÇEŞİTLERİ", category: "ÇORBA", price: 135, is_active: true },
    { name: "TENEKE GRUBU", category: "İÇECEK", price: 80, is_active: true },
    { name: "NİĞDE GAZOZU", category: "İÇECEK", price: 40, is_active: true },
    { name: "AYRAN", category: "İÇECEK", price: 40, is_active: true },
    { name: "ŞALGAM", category: "İÇECEK", price: 40, is_active: true },
    { name: "SU", category: "İÇECEK", price: 20, is_active: true },
    { name: "EKSTRA ANA YEMEK", category: "EKSTRA", price: 100, is_active: true },
    { name: "EKSTRA YARDIMCI", category: "EKSTRA", price: 50, is_active: true },
    { name: "EKSTRA TAMAMLAYICI", category: "EKSTRA", price: 35, is_active: true },
];

async function populateMenu() {
    console.log("Starting DB Population...");
    for (const item of MEYDAN_CORE_MENU) {
        // Check if item already exists
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('name', item.name)
            .eq('category', item.category);

        if (data && data.length > 0) {
            console.log(`Item ${item.name} already exists. Skipping.`);
            continue;
        }

        // Insert new item
        const { error: insertError } = await supabase
            .from('menu_items')
            .insert([item]);

        if (insertError) {
            console.error(`Error inserting ${item.name}:`, insertError);
        } else {
            console.log(`Successfully inserted ${item.name}.`);
        }
    }
    console.log("Population complete.");
}

populateMenu();
