-- Parçalı Ödemeler Tablosu
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  amount numeric not null,
  payment_method text not null, -- 'Nakit', 'Kredi Kartı', 'Havale/EFT'
  description text,
  created_at timestamp with time zone default now()
);

-- RLS Politikaları (Güvenlik)
alter table public.payments enable row level security;

-- Admin her şeyi görebilir/yapabilir
create policy "Admins can manage all payments" 
on public.payments for all 
using ( (select role from public.users where id = auth.uid()) = 'admin' );

-- Kullanıcılar kendi ödemelerini görebilir
create policy "Users can see their own payments" 
on public.payments for select 
using ( user_id = auth.uid() );
