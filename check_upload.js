const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpload() {
    console.log("Testing upload to menu-images...");
    const dummyContent = "Test";
    const fileName = `test_${Date.now()}.txt`;

    const { data, error } = await supabase.storage
        .from("menu-images")
        .upload(fileName, dummyContent, {
            contentType: "text/plain"
        });

    if (error) {
        console.error("Upload failed:", error);
    } else {
        console.log("Upload succeeded!");
    }
}

testUpload();
