import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmin() {
  const email = 'admin@meydan.com';
  console.log(`Checking user: ${email}`);

  // Check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Error listing auth users:", authError);
  } else {
    const user = authUsers.users.find(u => u.email === email);
    if (user) {
      console.log("Found in auth.users:", {
        id: user.id,
        email: user.email,
        last_sign_in_at: user.last_sign_in_at
      });

      // Check public.users
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (publicError) {
        console.error("Error fetching public user:", publicError);
      } else if (publicUser) {
        console.log("Found in public.users:", publicUser);
      } else {
        console.log("NOT found in public.users");
      }
    } else {
      console.log("NOT found in auth.users");
    }
  }
}

checkAdmin();
