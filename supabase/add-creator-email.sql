-- =====================================================================
-- TPAC Creators: email notifications, and a required email for every creator.
--
-- Every creator notification (written by the app or by the earnings triggers)
-- is also emailed. The server sends them from a small queue on
-- creator_notifications (email_status), so a notification written inside the
-- database (a new sale, a completed order) is emailed too, and a failed send is
-- retried. Run once in the Supabase SQL Editor (safe to run again).
-- =====================================================================

-- 1) the email queue on each notification
alter table public.creator_notifications add column if not exists email_status text not null default 'pending';
alter table public.creator_notifications add column if not exists email_attempts int not null default 0;
alter table public.creator_notifications add column if not exists email_claimed_at timestamptz;
alter table public.creator_notifications add column if not exists emailed_at timestamptz;
alter table public.creator_notifications add column if not exists email_error text;
do $$ begin
  alter table public.creator_notifications add constraint creator_notifications_email_status_check
    check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed'));
exception when duplicate_object then null; end $$;
-- notifications from before this change are not emailed now (no flood of old messages)
update public.creator_notifications set email_status = 'skipped', email_error = 'before_email'
  where email_status = 'pending' and created_at < now() - interval '10 minutes';
create index if not exists creator_notifications_email_queue on public.creator_notifications(created_at) where email_status in ('pending', 'sending');

-- 2) the creator can turn off the optional emails (account and payout emails are always sent)
alter table public.creators add column if not exists email_notifications boolean not null default true;

-- 3) email is required: fill missing ones from the creator's TPAC account, then enforce it
update public.creators c set email = lower(u.email)
  from auth.users u
  where u.id = c.user_id and (c.email is null or c.email = '') and u.email is not null and u.email <> '';
do $$ begin
  if not exists (select 1 from public.creators where email is null or email = '') then
    alter table public.creators alter column email set not null;
  else
    raise notice 'Some creators still have no email — they must add one from their profile before it can be enforced.';
  end if;
end $$;
do $$ begin
  alter table public.creators add constraint creators_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
exception when duplicate_object then null; end $$;
