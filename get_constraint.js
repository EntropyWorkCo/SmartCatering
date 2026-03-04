const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'adisyon_status_check';" });
  console.log(data, error);
}
run();
