import { supabase } from "./lib/supabase";

async function test() {
  const { data, error } = await supabase.from('menu_items').select('*').limit(1);
  console.log(error || "Success");
}
test();
