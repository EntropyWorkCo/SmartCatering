const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupDatabase() {
    console.log("Checking DB schema...");

    // Create bucket if not exists
    console.log("Creating menu-images bucket...");
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('menu-images', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
    });

    if (bucketError) {
        if (bucketError.message.includes('already exists') || bucketError.message.includes('duplicate')) {
            console.log("Bucket 'menu-images' already exists.");
        } else {
            console.error("Error creating bucket:", bucketError);
        }
    } else {
        console.log("Bucket created successfully.");
    }
}

setupDatabase();
