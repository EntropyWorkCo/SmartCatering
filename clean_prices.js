const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
    console.log("Fetching all system_fiyati...");
    const { data: all } = await supabase.from('menu_items')
        .select('id, name, created_at')
        .eq('status', 'sistem_fiyati')
        .order('created_at', { ascending: false });

    if (all && all.length > 14) {
        // Keep the most recent 14 (which we just inserted)
        const toKeepIds = all.slice(0, 14).map(item => item.id);

        console.log("Archiving old items...");
        const { error } = await supabase.from('menu_items')
            .update({ status: 'archive_sistem_fiyati' })
            .eq('status', 'sistem_fiyati')
            .not('id', 'in', `(${toKeepIds.join(',')})`);

        if (error) console.error("Error archiving:", error);
        else console.log("Archived successfully.");
    } else {
        console.log("No duplicates found to clean (length: " + all?.length + ")");
    }
}

clean();
