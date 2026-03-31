import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

// Look for .env in the parent or current dir
const envPath = '../.env';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const supabaseUrl = envContent.match(/SUPABASE_URL=(.*)/)?.[1]?.trim();
    const supabaseKey = envContent.match(/SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

    if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from('users').select('*').limit(1);
        if (error) {
            console.error(error);
        } else {
            console.log("Columns:", Object.keys(data[0] || {}));
        }
    } else {
        console.log("Supabase URL or Key not found in .env");
    }
} else {
    console.log(".env not found at " + envPath);
}
