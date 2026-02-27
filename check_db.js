const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addImageColumn() {
    console.log("Adding image_url column to menu_items...");

    // Note: We can't execute raw DDL via the standard JS client without a custom RPC function.
    // Instead, let's just make a dummy 'select' with image_url to see if it even exists.
    const { data, error } = await supabase
        .from("menu_items")
        .select("image_url")
        .limit(1);

    if (error && error.code === '42703') {
        console.error("COLUMN DOES NOT EXIST. The user MUST add 'image_url' (text) manually in the Supabase Table Editor.");
    } else if (error) {
        console.error("Error checking column:", error);
    } else {
        console.log("Column image_url ALREADY EXISTS. Issue is elsewhere.");
    }
}

addImageColumn();
