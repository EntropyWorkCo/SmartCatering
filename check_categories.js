const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCategories() {
    console.log("Checking categories and images in menu_items...");

    const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, category, price, image_url");

    if (error) {
        console.error("Error fetching items:", error);
    } else {
        const categories = new Set(data.map(item => item.category));
        console.log("Existing categories in DB:", Array.from(categories));
        console.log("Items with image URLs:", data.filter(i => i.image_url));
        console.log("Total items:", data.length);
    }
}

checkCategories();
