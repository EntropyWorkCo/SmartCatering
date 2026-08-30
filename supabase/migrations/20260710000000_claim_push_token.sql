-- Push token'ı güvenli şekilde mevcut kullanıcıya atar.
-- Sorun: eski "ghost token fix" istemci tarafında başka kullanıcıların satırını
-- güncellemeye çalışıyordu; RLS bunu sessizce engelliyordu (0 satır).
-- Çözüm: security definer RPC — RLS'i atlar ama yalnızca push_token kolonuna
-- ve yalnızca auth.uid() doğrulamasıyla dokunur.

create or replace function public.claim_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'invalid token';
  end if;

  -- Bu token'ı (bu cihazı) daha önce kullanmış diğer hesaplardan temizle
  update public.users
     set push_token = null
   where push_token = p_token
     and id <> auth.uid();

  -- Token'ı şu anki kullanıcıya ata
  update public.users
     set push_token = p_token
   where id = auth.uid();
end;
$$;

revoke all on function public.claim_push_token(text) from public;
grant execute on function public.claim_push_token(text) to authenticated;
