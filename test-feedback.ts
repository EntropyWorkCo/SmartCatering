import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.from('feedbacks').insert([{ 
    user_id: '123e4567-e89b-12d3-a456-426614174000', // random uuid
    comment: 'test feedback', 
    rating: null,
    type: 'app_feedback'
  }]);
  console.log("Error:", error);
}
run();
