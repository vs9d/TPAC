-- =====================================================================
-- TPAC Creators: designers open their own store inside TPAC.
--
-- A creator's design on a garment is a normal product (products + variants +
-- product_designs + photos), so it is sold through the existing cart, checkout,
-- orders and payment. What is new:
--   creators            the creator's account and public page (approved by staff)
--   creator_products    one listing: which product, the creator's markup, review status
--   creator_earnings    the ledger: one row per order line, written by a trigger when the
--                       order is placed, with the commission rule in force AT THAT MOMENT
--   creator_withdrawals payout requests, reviewed by staff
--   creator_notifications, creator_stats_daily, creator_follows
-- Every table is server-only (RLS on, no policies): the app checks who is asking.
-- Prices and earnings are never taken from the browser.
-- =====================================================================

create table if not exists public.creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_.]{2,29}$'),
  display_name text not null check (length(display_name) between 2 and 60),
  bio text check (bio is null or length(bio) <= 600),
  avatar_url text check (avatar_url is null or length(avatar_url) <= 1000),
  cover_url text check (cover_url is null or length(cover_url) <= 1000),
  phone text,
  email text,
  socials jsonb not null default '{}'::jsonb,           -- { instagram, tiktok, facebook, behance, website }
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text check (review_note is null or length(review_note) <= 1000),
  -- this creator's own commission (null = the platform default)
  commission_mode text check (commission_mode is null or commission_mode in ('percent', 'fixed')),
  commission_value int check (commission_value is null or commission_value >= 0),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.creators enable row level security;

-- which garments creators may use, the most they may add on top, and an optional commission for that garment
alter table public.product_types add column if not exists creator_enabled boolean not null default false;
alter table public.product_types add column if not exists creator_max_markup int check (creator_max_markup is null or creator_max_markup >= 0);
alter table public.product_types add column if not exists creator_commission_mode text check (creator_commission_mode is null or creator_commission_mode in ('percent', 'fixed'));
alter table public.product_types add column if not exists creator_commission_value int check (creator_commission_value is null or creator_commission_value >= 0);

alter table public.products add column if not exists creator_id uuid references public.creators(user_id) on delete set null;
create index if not exists products_creator_idx on public.products(creator_id) where creator_id is not null;

create table if not exists public.creator_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  product_id uuid not null unique references public.products(id) on delete cascade,
  product_type_id uuid references public.product_types(id) on delete set null,
  title text not null check (length(title) between 2 and 80),
  description text check (description is null or length(description) <= 2000),
  category text check (category is null or length(category) <= 40),
  tags text[] not null default '{}',
  base_price int not null default 0 check (base_price >= 0),   -- TPAC's price for the garment when submitted
  markup int not null default 0 check (markup >= 0),            -- what the creator adds on top
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'changes_requested', 'hidden')),
  review_note text check (review_note is null or length(review_note) <= 1000),
  view_count int not null default 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_products_creator_idx on public.creator_products(creator_id, created_at desc);
create index if not exists creator_products_status_idx on public.creator_products(status, submitted_at);
alter table public.creator_products enable row level security;

create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid unique references public.order_items(id) on delete set null,
  creator_product_id uuid references public.creator_products(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  order_number text not null,
  product_name text not null,
  size_code text,
  quantity int not null check (quantity > 0),
  unit_price int not null,
  base_price int not null,
  markup int not null,
  -- the rule applied at the moment of the sale (later changes never rewrite history)
  commission_mode text not null check (commission_mode in ('percent', 'fixed')),
  commission_value int not null,
  amount int not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'cleared', 'void')),
  available_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_earnings_creator_idx on public.creator_earnings(creator_id, created_at desc);
create index if not exists creator_earnings_order_idx on public.creator_earnings(order_id);
alter table public.creator_earnings enable row level security;

create table if not exists public.creator_withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete restrict,
  amount int not null check (amount > 0),
  method text not null check (length(method) between 2 and 40),
  account text not null check (length(account) between 3 and 200),
  status text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  admin_note text check (admin_note is null or length(admin_note) <= 500),
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists creator_withdrawals_creator_idx on public.creator_withdrawals(creator_id, created_at desc);
alter table public.creator_withdrawals enable row level security;

create table if not exists public.creator_notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists creator_notifications_idx on public.creator_notifications(creator_id, created_at desc);
alter table public.creator_notifications enable row level security;

create table if not exists public.creator_stats_daily (
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  day date not null,
  page_views int not null default 0,
  product_views int not null default 0,
  primary key (creator_id, day)
);
alter table public.creator_stats_daily enable row level security;

create table if not exists public.creator_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);
alter table public.creator_follows enable row level security;

-- platform defaults (Dashboard → Creators → Settings)
insert into public.website_settings (key, value)
values ('creators', '{"commission_mode":"percent","commission_value":70,"min_withdrawal":25000,"hold_days":7,"review_required":true,"max_markup":30000,"payout_methods":["ZainCash","AsiaPay","تحويل مصرفي"]}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------------ views counters
create or replace function public.creator_track(p_creator uuid, p_kind text, p_product uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.creator_stats_daily (creator_id, day, page_views, product_views)
  values (p_creator, current_date, case when p_kind = 'page' then 1 else 0 end, case when p_kind = 'product' then 1 else 0 end)
  on conflict (creator_id, day) do update set
    page_views = creator_stats_daily.page_views + excluded.page_views,
    product_views = creator_stats_daily.product_views + excluded.product_views;
  if p_kind = 'product' and p_product is not null then
    update public.creator_products set view_count = view_count + 1 where product_id = p_product;
  end if;
end $$;

-- ------------------------------------------------------------------ earnings: written when an order line is created
create or replace function public.creator_earning_on_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_creator uuid;
  cp public.creator_products;
  pt public.product_types;
  cr public.creators;
  s jsonb;
  v_mode text;
  v_value int;
  v_markup int;
  v_amount int;
  v_order public.orders;
begin
  if new.product_id is null then return new; end if;
  select creator_id into v_creator from public.products where id = new.product_id;
  if v_creator is null then return new; end if;
  select * into cr from public.creators where user_id = v_creator;
  select * into cp from public.creator_products where product_id = new.product_id;
  if cr.user_id is null or cp.id is null then return new; end if;
  select * into pt from public.product_types where id = cp.product_type_id;
  select value into s from public.website_settings where key = 'creators';
  -- the rule: this creator's own > this garment's > the platform default
  v_mode := coalesce(cr.commission_mode, pt.creator_commission_mode, s ->> 'commission_mode', 'percent');
  v_value := coalesce(case when cr.commission_mode is not null then cr.commission_value end,
                      case when pt.creator_commission_mode is not null then pt.creator_commission_value end,
                      (s ->> 'commission_value')::int, 70);
  -- the creator's share comes out of what they added on top of TPAC's garment price
  v_markup := greatest(0, least(cp.markup, new.unit_price - cp.base_price));
  v_amount := case when v_mode = 'fixed' then v_value * new.quantity
                   else round(v_markup * least(v_value, 100) / 100.0)::int * new.quantity end;
  select * into v_order from public.orders where id = new.order_id;
  insert into public.creator_earnings (creator_id, order_id, order_item_id, creator_product_id, product_id, order_number, product_name, size_code,
    quantity, unit_price, base_price, markup, commission_mode, commission_value, amount)
  values (v_creator, new.order_id, new.id, cp.id, new.product_id, v_order.order_number, coalesce(cp.title, new.name_ar), new.size_code,
    new.quantity, new.unit_price, cp.base_price, v_markup, v_mode, v_value, v_amount)
  on conflict (order_item_id) do nothing;
  insert into public.creator_notifications (creator_id, kind, title, body, link)
  values (v_creator, 'sale', 'بيعة جديدة 🎉', cp.title || ' × ' || new.quantity || ' — ربحك ' || v_amount || ' د.ع (معلّق لحد ما يكتمل الطلب)', '/creator-studio/orders');
  return new;
end $$;
drop trigger if exists creator_earning_on_item on public.order_items;
create trigger creator_earning_on_item after insert on public.order_items
  for each row execute function public.creator_earning_on_item();

-- the order's progress decides the earning: delivered → cleared (withdrawable after the return window), cancelled → void
create or replace function public.creator_earning_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hold int := coalesce(((select value from public.website_settings where key = 'creators') ->> 'hold_days')::int, 7);
  r record;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'delivered' then
    for r in update public.creator_earnings set status = 'cleared', available_at = now() + make_interval(days => v_hold), updated_at = now()
              where order_id = new.id and status = 'pending' returning creator_id, amount, product_name loop
      insert into public.creator_notifications (creator_id, kind, title, body, link)
      values (r.creator_id, 'earning', 'اكتمل طلب ✓', r.product_name || ' — ' || r.amount || ' د.ع ينضاف لرصيدك القابل للسحب بعد ' || v_hold || ' أيام', '/creator-studio/wallet');
    end loop;
  elsif new.status = 'cancelled' then
    for r in update public.creator_earnings set status = 'void', void_reason = 'cancelled', updated_at = now()
              where order_id = new.id and status <> 'void' returning creator_id, product_name loop
      insert into public.creator_notifications (creator_id, kind, title, body, link)
      values (r.creator_id, 'earning', 'انلغى طلب', r.product_name || ' — الربح انشال', '/creator-studio/orders');
    end loop;
  elsif old.status = 'delivered' then
    -- moved back from delivered: not withdrawable any more
    update public.creator_earnings set status = 'pending', available_at = null, updated_at = now() where order_id = new.id and status = 'cleared';
  end if;
  return new;
end $$;
drop trigger if exists creator_earning_on_status on public.orders;
create trigger creator_earning_on_status after update of status on public.orders
  for each row execute function public.creator_earning_on_status();

revoke all on function public.creator_track(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.creator_track(uuid, text, uuid) to service_role;
