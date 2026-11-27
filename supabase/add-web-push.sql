-- =====================================================================
-- TPAC app: push notifications on the phone (installed app / browser).
--
-- push_subscriptions  one row per device that allowed notifications, tied to the
--                     signed-in account (customer, creator or staff).
-- app_secrets         server-only keys (the push signing key pair is created
--                     here automatically the first time, unless VAPID_* env vars are set).
-- Both tables: RLS on with no policies — only the server (service role) reads them.
-- creator_notifications.pushed_at: each creator notification is pushed once.
-- Run once in the Supabase SQL Editor (safe to run again).
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  user_agent text,
  failures int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.app_secrets (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

alter table public.creator_notifications add column if not exists pushed_at timestamptz;
-- older notifications are not pushed now
update public.creator_notifications set pushed_at = created_at where pushed_at is null and created_at < now() - interval '10 minutes';
