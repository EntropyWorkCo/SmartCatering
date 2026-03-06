import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
console.log("URL:", supabaseUrl ? "Found" : "Missing");
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    // Insert 1
    const res1 = await supabase.from('menu_items').insert({ name: 'Test 1', category: 'TEST_CAT', price: 10, status: 'passive', is_active: false });
    console.log("Insert 1:", res1.error ? res1.error.message : "Success");
    
    // Insert 2
    const res2 = await supabase.from('menu_items').insert({ name: 'Test 2', category: 'TEST_CAT', price: 10, status: 'passive', is_active: false });
    console.log("Insert 2:", res2.error ? res2.error.message : "Success");

    // Cleanup
    await supabase.from('menu_items').delete().eq('category', 'TEST_CAT');
}

checkConstraints();
