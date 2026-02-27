const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRecentItems() {
    console.log("Fetching recent menu items...");

    const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching items:", error);
    } else {
        for (const item of data) {
            console.log(`ID: ${item.id} | Name: ${item.name} | Category: ${item.category} | Price: ${item.price} | Image URL: ${item.image_url}`);
        }
    }
}

checkRecentItems();
