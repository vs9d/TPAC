-- TPAC: shared couple designs, group orders by link, and the community designs page.
-- Every table here is reached only through the app's server code (service role):
-- links carry a long random token, so there is no public read/write policy.

-- ------------------------------------------------------------------ 1. shared couple designs
-- One couple design, two people: the owner sends a link, the partner designs the second piece.
create table if not exists public.design_drafts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  garment_type text not null,
  -- { pieces: [ { objects: [...fabric objects], colorId, sizes } x2 ], from_name, to_name }
  data jsonb not null default '{}'::jsonb,
  partner_done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists design_drafts_expires_idx on public.design_drafts(expires_at);
alter table public.design_drafts enable row level security;

-- ------------------------------------------------------------------ 2. group orders by link
create table if not exists public.group_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]{6,16}$'),             -- the link members open
  admin_token text not null unique check (admin_token ~ '^[A-Za-z0-9_-]{20,64}$'), -- the organiser's own link
  title text not null check (length(title) between 2 and 120),
  organizer_name text not null check (length(organizer_name) between 2 and 80),
  organizer_phone text not null,
  product_id uuid references public.products(id) on delete set null,
  product_type text not null default 'hoodie',
  idea text check (idea is null or length(idea) <= 1000),
  allow_names boolean not null default true,
  deadline date,
  status text not null default 'open' check (status in ('open', 'closed', 'submitted')),
  bulk_request_id uuid references public.bulk_order_requests(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.group_order_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_orders(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  size_code text not null check (size_code ~ '^[A-Z0-9]{1,6}$'),
  quantity int not null default 1 check (quantity between 1 and 20),
  print_name text check (print_name is null or length(print_name) <= 30),
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists group_order_members_group_idx on public.group_order_members(group_id, created_at);
alter table public.group_orders enable row level security;
alter table public.group_order_members enable row level security;
alter table public.bulk_order_requests add column if not exists group_order_id uuid references public.group_orders(id) on delete set null;

-- ------------------------------------------------------------------ 3. designs by customers (community page)
create table if not exists public.community_designs (
  id uuid primary key default gen_random_uuid(),
  custom_design_id uuid references public.custom_designs(id) on delete set null,
  garment_type text not null,
  color_id uuid,
  title text not null check (length(title) between 2 and 60),
  designer_name text not null check (length(designer_name) between 2 and 60),
  designer_phone text,                                     -- private: to give the designer their reward
  user_id uuid references auth.users(id) on delete set null,
  fabric jsonb not null,                                   -- the studio layout, to open it again
  artwork_ids uuid[] not null default '{}',
  preview_front_path text,                                 -- private previews of the saved design
  preview_back_path text,
  image_front text,                                        -- public copies, made when approved
  image_back text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  reward_per_sale int not null default 2000 check (reward_per_sale >= 0),
  rewards_paid int not null default 0 check (rewards_paid >= 0),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists community_designs_status_idx on public.community_designs(status, approved_at desc);
alter table public.community_designs enable row level security;
-- a piece ordered from a community design remembers it, so its designer is credited
alter table public.custom_designs add column if not exists community_design_id uuid references public.community_designs(id) on delete set null;
create index if not exists custom_designs_community_idx on public.custom_designs(community_design_id) where community_design_id is not null;
