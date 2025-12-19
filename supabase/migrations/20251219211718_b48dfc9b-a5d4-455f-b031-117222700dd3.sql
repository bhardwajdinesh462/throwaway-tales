-- Fix guest realtime access without exposing temp_emails rows to anon
-- Realtime does not send request headers, so header-based RLS helpers can't be used for realtime.

-- 1) Security definer helper to classify guest temp emails
create or replace function public.is_guest_temp_email(_temp_email_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.temp_emails te
    where te.id = _temp_email_id
      and te.user_id is null
  );
$$;

grant execute on function public.is_guest_temp_email(uuid) to anon, authenticated;

-- 2) Replace anon policy that joined temp_emails (fails under realtime due to temp_emails RLS)
drop policy if exists "Anonymous can view guest temp email messages" on public.received_emails;

create policy "Anonymous can view guest temp email messages"
on public.received_emails
for select
to anon
using (public.is_guest_temp_email(received_emails.temp_email_id));
