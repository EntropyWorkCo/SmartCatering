const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const statusesToTest = ['PENDING', 'PREPARING', 'ON_WAY', 'ON_THE_WAY', 'YOLDA', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'PAID'];
    const results = {};
    for (const status of statusesToTest) {
        const { data, error } = await supabase.from('adisyon').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            total_amount: 0,
            status: status
        }).select();
        
        if (error && error.code === '23514') {
            results[status] = 'NOT ALLOWED';
        } else {
            // error.code '23503' is foreign key violation which means check constraint passed!
            results[status] = 'ALLOWED';
        }
    }
    fs.writeFileSync('test-output.json', JSON.stringify(results, null, 2));
    console.log("Done. Check test-output.json");
}

run();
