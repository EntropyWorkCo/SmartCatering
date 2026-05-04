const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://vruwzmljqfvnerenwzpy.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydXd6bWxqcWZ2bmVyZW53enB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjgwNjIsImV4cCI6MjA4Njg0NDA2Mn0.DyFBoBjHhvd67xwiR0YTHu_bkHR3-klsRu36EFq0hSE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('feedbacks').insert([{ 
    user_id: '4bd44356-fdf9-425b-ae49-1ff02a9eb776', // User uuid not matched error might occur because of RLS or foreign key
    note: 'test feedback from script', 
    rating: null,
    type: 'app_feedback'
  }]);
  console.log("Insert response:", error || data);
}
run();
