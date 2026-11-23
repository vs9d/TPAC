-- =====================================================================
-- TPAC: portfolio (previous clients & projects), quotation requests v2,
-- WhatsApp order notifications (queue, retries, opt-in, delivery status).
-- Coupons use the existing discount_codes / discount_usage tables.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------- portfolio
create table if not exists public.portfolio_clients (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (length(name_ar) between 1 and 120),
  name_en text check (name_en is null or length(name_en) <= 120),
  category text not null default 'company' check (category in ('university', 'college', 'company', 'organization', 'custom')),
  logo_url text check (logo_url is null or length(logo_url) <= 1000),
  logo_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_clients_order_idx on public.portfolio_clients (sort_order, created_at);

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.portfolio_clients(id) on delete set null,
  title_ar text not null check (length(title_ar) between 1 and 160),
  title_en text check (title_en is null or length(title_en) <= 160),
  description_ar text check (description_ar is null or length(description_ar) <= 2000),
  description_en text check (description_en is null or length(description_en) <= 2000),
  category text not null default 'company' check (category in ('university', 'college', 'company', 'organization', 'custom')),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 24),
  completed_on date,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_projects_order_idx on public.portfolio_projects (is_featured desc, sort_order, created_at desc);
drop trigger if exists portfolio_projects_updated on public.portfolio_projects;
create trigger portfolio_projects_updated before update on public.portfolio_projects for each row execute function public.set_updated_at();

alter table public.portfolio_clients enable row level security;
alter table public.portfolio_projects enable row level security;
drop policy if exists portfolio_clients_read on public.portfolio_clients;
create policy portfolio_clients_read on public.portfolio_clients for select to anon, authenticated using (is_active or public.is_staff());
drop policy if exists portfolio_clients_staff on public.portfolio_clients;
create policy portfolio_clients_staff on public.portfolio_clients for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists portfolio_projects_read on public.portfolio_projects;
create policy portfolio_projects_read on public.portfolio_projects for select to anon, authenticated using (is_active or public.is_staff());
drop policy if exists portfolio_projects_staff on public.portfolio_projects;
create policy portfolio_projects_staff on public.portfolio_projects for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------- quotation requests
alter table public.bulk_order_requests add column if not exists quantity_min int check (quantity_min is null or quantity_min > 0);
alter table public.bulk_order_requests add column if not exists quantity_max int check (quantity_max is null or quantity_max > 0);
alter table public.bulk_order_requests add column if not exists preferred_color text check (preferred_color is null or length(preferred_color) <= 120);
alter table public.bulk_order_requests add column if not exists quoted_unit_price int check (quoted_unit_price is null or quoted_unit_price >= 0);
alter table public.bulk_order_requests add column if not exists quoted_quantity int check (quoted_quantity is null or quoted_quantity > 0);
alter table public.bulk_order_requests drop constraint if exists bulk_order_requests_qty_range;
alter table public.bulk_order_requests add constraint bulk_order_requests_qty_range check (quantity_min is null or quantity_max is null or quantity_max >= quantity_min);

-- ---------------------------------------------------------------- WhatsApp notifications
-- customers choose at checkout whether they want order updates on WhatsApp
alter table public.orders add column if not exists whatsapp_opt_in boolean not null default false;
-- queue: retries with back-off, one message per order + status (dedupe_key), delivery status from Meta's webhook
alter table public.notifications add column if not exists attempts int not null default 0;
alter table public.notifications add column if not exists next_attempt_at timestamptz;
alter table public.notifications add column if not exists dedupe_key text;
alter table public.notifications add column if not exists provider_message_id text;
alter table public.notifications add column if not exists provider_status text check (provider_status is null or provider_status in ('accepted', 'sent', 'delivered', 'read', 'failed'));
alter table public.notifications add column if not exists delivered_at timestamptz;
alter table public.notifications add column if not exists payload jsonb;
create unique index if not exists notifications_dedupe_idx on public.notifications (dedupe_key) where dedupe_key is not null;
create index if not exists notifications_retry_idx on public.notifications (next_attempt_at) where status = 'pending';
create index if not exists notifications_provider_idx on public.notifications (provider_message_id) where provider_message_id is not null;
