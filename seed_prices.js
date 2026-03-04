const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

const supabase = createClient(supabaseUrl, supabaseKey);

const newPrices = [
  // TABLDOT MENÜ
  { name: 'TABLDOT ( 4 ÇEŞİT )', category: 'TABLDOT', price: 320, status: 'sistem_fiyati' },
  { name: 'TABLDOT ( 3 ÇEŞİT )', category: 'TABLDOT', price: 300, status: 'sistem_fiyati' },
  { name: 'TABLDOT ( 2 ÇEŞİT )', category: 'TABLDOT', price: 280, status: 'sistem_fiyati' },
  // EKSTRA FARKLARI
  { name: 'EKSTRA ANA YEMEK', category: 'EKSTRA', price: 100, status: 'sistem_fiyati' },
  { name: 'EKSTRA YARDIMCI', category: 'EKSTRA', price: 50, status: 'sistem_fiyati' },
  { name: 'EKSTRA TAMAMLAYICI', category: 'EKSTRA', price: 35, status: 'sistem_fiyati' },
  // TEK ÇEŞİT
  { name: 'ANA YEMEK', category: 'TEK ÇEŞİT', price: 180, status: 'sistem_fiyati' },
  { name: 'YARDIMCI', category: 'TEK ÇEŞİT', price: 90, status: 'sistem_fiyati' },
  { name: 'ÇORBA ÇEŞİTLERİ', category: 'TEK ÇEŞİT', price: 135, status: 'sistem_fiyati' },
  // İÇECEKLER
  { name: 'TENEKE GRUBU', category: 'İÇECEK', price: 80, status: 'sistem_fiyati' },
  { name: 'NİĞDE GAZOZU', category: 'İÇECEK', price: 40, status: 'sistem_fiyati' },
  { name: 'AYRAN', category: 'İÇECEK', price: 40, status: 'sistem_fiyati' },
  { name: 'ŞALGAM', category: 'İÇECEK', price: 40, status: 'sistem_fiyati' },
  { name: 'SU', category: 'İÇECEK', price: 20, status: 'sistem_fiyati' }
];

async function seed() {
  console.log("Deleting old system prices...");
  const { error: delError } = await supabase.from('menu_items').delete().eq('status', 'sistem_fiyati');
  if (delError) console.error("Error deleting:", delError);

  console.log("Inserting new prices...");
  const { data, error: insError } = await supabase.from('menu_items').insert(newPrices).select();
  if (insError) console.error("Error inserting:", insError);
  else console.log("Seeded successfully:", data?.length, "items");
}

seed();
