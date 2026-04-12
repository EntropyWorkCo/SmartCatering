const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('companies').select('*').limit(1);
  if (error) {
    console.error("Error fetching companies:", error.message);
    return;
  }
  console.log("Found companies columns:", Object.keys(data[0] || {}));
}

check();
