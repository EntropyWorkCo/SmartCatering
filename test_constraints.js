const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTriggers() {
    console.log("Testing with actual categories...");

    // Test with "ANA YEMEK" which is an actual category
    const rs1 = await supabase.from('menu_items').insert({ name: 'Bulk Test 1', category: 'ANA YEMEK', price: 10, status: 'passive', is_active: false });
    console.log("Insert ANA YEMEK 1:", rs1.error ? rs1.error.message : "Success");

    const rs2 = await supabase.from('menu_items').insert({ name: 'Bulk Test 2', category: 'ANA YEMEK', price: 10, status: 'passive', is_active: false });
    console.log("Insert ANA YEMEK 2:", rs2.error ? rs2.error.message : "Success");

    const act1 = await supabase.from('menu_items').update({ status: 'draft', is_active: false }).eq('name', 'Bulk Test 1');
    console.log("Drafting 1:", act1.error ? act1.error.message : "Success");

    const act2 = await supabase.from('menu_items').update({ status: 'draft', is_active: false }).eq('name', 'Bulk Test 2');
    console.log("Drafting 2:", act2.error ? act2.error.message : "Success");

    const publish1 = await supabase.from('menu_items').update({ status: 'active', is_active: true }).eq('name', 'Bulk Test 1');
    console.log("Activating 1:", publish1.error ? publish1.error.message : "Success");

    const publish2 = await supabase.from('menu_items').update({ status: 'active', is_active: true }).eq('name', 'Bulk Test 2');
    console.log("Activating 2:", publish2.error ? publish2.error.message : "Success");

    await supabase.from('menu_items').delete().like('name', 'Bulk Test%');
}

checkTriggers();
