import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabase = createClient(
  'https://vruwzmljqfvnerenwzpy.supabase.co',
  ''
)

const { error } = await supabase
  .from('users')
  .delete()
  .or('phone.in.("+905551000001","+905551000002","05551000001","05551000002"),email.eq.apple-admin@smartcatering.com')

if (error) console.error('Hata:', error)
else console.log('Apple test hesapları başarıyla temizlendi.')
