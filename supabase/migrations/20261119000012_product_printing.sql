-- =====================================================================
-- TPAC: product printing — PART 1 of 2 (tables + security).
-- Supabase → SQL Editor → New query → paste → Run. Then run PART 2.
-- Safe to run more than once. Nothing is deleted.
-- =====================================================================

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and length(code) <= 40),
  name_ar text not null check (length(name_ar) between 1 and 80),
  name_en text not null check (length(name_en) between 1 and 80),
  description_ar text check (description_ar is null or length(description_ar) <= 500),
  description_en text check (description_en is null or length(description_en) <= 500),
  garment_shape text check (garment_shape is null or garment_shape in ('tshirt', 'oversized', 'hoodie', 'sweatshirt', 'longsleeve')),
  default_price int not null default 0 check (default_price >= 0),
  default_sizes text[] not null default '{S,M,L,XL,XXL}',
  default_color_ids uuid[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_type_views (
  id uuid primary key default gen_random_uuid(),
  product_type_id uuid not null references public.product_types(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and length(code) <= 30),
  name_ar text not null check (length(name_ar) between 1 and 60),
  name_en text not null check (length(name_en) between 1 and 60),
  mockup_url text check (mockup_url is null or length(mockup_url) <= 1000),
  mockup_path text,
  mockup_width int not null default 600 check (mockup_width between 50 and 10000),
  mockup_height int not null default 700 check (mockup_height between 50 and 10000),
  color_mockups jsonb not null default '{}'::jsonb check (jsonb_typeof(color_mockups) = 'object'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (product_type_id, code)
);

create table if not exists public.product_print_areas (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.product_type_views(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and length(code) <= 30),
  name_ar text not null check (length(name_ar) between 1 and 60),
  name_en text not null check (length(name_en) between 1 and 60),
  x numeric(7, 5) not null check (x >= 0 and x < 1),
  y numeric(7, 5) not null check (y >= 0 and y < 1),
  width numeric(7, 5) not null check (width > 0 and width <= 1),
  height numeric(7, 5) not null check (height > 0 and height <= 1),
  max_width_cm numeric(5, 1) not null check (max_width_cm > 0 and max_width_cm <= 200),
  max_height_cm numeric(5, 1) not null check (max_height_cm > 0 and max_height_cm <= 200),
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (view_id, code),
  check (x + width <= 1.0001 and y + height <= 1.0001)
);

alter table public.products add column if not exists product_type_id uuid references public.product_types(id) on delete set null;
alter table public.products add column if not exists print_enabled boolean not null default true;
alter table public.products add column if not exists disabled_print_area_ids uuid[] not null default '{}';
create index if not exists products_type_idx on public.products(product_type_id) where product_type_id is not null;

create table if not exists public.product_designs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  area_id uuid not null references public.product_print_areas(id) on delete cascade,
  artwork_url text not null check (length(artwork_url) <= 1000),
  artwork_path text,
  artwork_width int check (artwork_width is null or artwork_width > 0),
  artwork_height int check (artwork_height is null or artwork_height > 0),
  x numeric(7, 5) not null check (x >= 0),
  y numeric(7, 5) not null check (y >= 0),
  width numeric(7, 5) not null check (width > 0),
  height numeric(7, 5) not null check (height > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (x + width <= 1.0001 and y + height <= 1.0001)
);
create index if not exists product_designs_product_idx on public.product_designs(product_id, sort_order);

alter table public.product_images add column if not exists view_id uuid references public.product_type_views(id) on delete set null;
alter table public.product_images add column if not exists is_generated boolean not null default false;

create or replace trigger product_types_updated before update on public.product_types for each row execute function public.set_updated_at();
create or replace trigger product_designs_updated before update on public.product_designs for each row execute function public.set_updated_at();

-- security: everyone reads, only staff write (policies are created once, never dropped)
do $$
declare t text;
begin
  foreach t in array array['product_types', 'product_type_views', 'product_print_areas', 'product_designs'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
      if t = 'product_designs' then
        execute 'create policy product_designs_read on public.product_designs for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.is_published or public.is_staff())))';
      else
        execute format('create policy %I on public.%I for select to anon, authenticated using (is_active or public.is_staff())', t || '_read', t);
      end if;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_write') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t || '_write', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- TPAC: product printing — PART 2 of 2 (built-in types + settings).
-- Run PART 1 first. Safe to run more than once; your changes are kept.
-- =====================================================================

-- built-in types (hoodie, T-shirt…) laid out like the drawn garments
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, sort_order) values
  ('tshirt', 'تيشيرت', 'T-shirt', 'tshirt', 20000, 1),
  ('oversized', 'تيشيرت أوفرسايز', 'Oversized tee', 'oversized', 25000, 2),
  ('hoodie', 'هودي', 'Hoodie', 'hoodie', 40000, 3),
  ('sweatshirt', 'سويتشيرت', 'Sweatshirt', 'sweatshirt', 35000, 4),
  ('longsleeve', 'كم طويل', 'Long sleeve', 'longsleeve', 28000, 5)
on conflict (code) do nothing;

insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select t.id, v.code, v.name_ar, v.name_en, 600, 700, v.sort_order
  from public.product_types t
 cross join (values ('front', 'الأمام', 'Front', 0), ('back', 'الخلف', 'Back', 1)) as v(code, name_ar, name_en, sort_order)
 where t.garment_shape is not null
on conflict (product_type_id, code) do nothing;

-- an earlier dashboard version saved some placement codes with "-" (left-chest, sleeve-left): repair them
update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));

insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, a.code, n.name_ar, n.name_en, a.x, a.y, a.w, a.h, a.cw, a.ch, a.s
  from (values
    ('tshirt', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('tshirt', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('tshirt', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('tshirt', 'sleeve', 0.10333, 0.21429, 0.08667, 0.07429, 8, 8, 3),
    ('tshirt', 'sleeve_left', 0.81000, 0.21429, 0.08667, 0.07429, 8, 8, 4),
    ('oversized', 'front', 0.32000, 0.21429, 0.36000, 0.42857, 32, 42, 0),
    ('oversized', 'back', 0.30667, 0.18286, 0.38667, 0.48571, 34, 48, 1),
    ('oversized', 'left_chest', 0.58667, 0.20000, 0.12000, 0.10286, 10, 10, 2),
    ('oversized', 'sleeve', 0.06667, 0.28571, 0.09333, 0.08000, 8, 8, 3),
    ('oversized', 'sleeve_left', 0.84000, 0.28571, 0.09333, 0.08000, 8, 8, 4),
    ('hoodie', 'front', 0.34000, 0.27143, 0.32000, 0.31429, 28, 30, 0),
    ('hoodie', 'back', 0.31667, 0.33714, 0.36667, 0.41429, 32, 40, 1),
    ('hoodie', 'left_chest', 0.58333, 0.25143, 0.10667, 0.09143, 10, 10, 2),
    ('hoodie', 'sleeve', 0.13333, 0.27143, 0.07667, 0.06571, 8, 8, 3),
    ('hoodie', 'sleeve_left', 0.79000, 0.27143, 0.07667, 0.06571, 8, 8, 4),
    ('sweatshirt', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('sweatshirt', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('sweatshirt', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('sweatshirt', 'sleeve', 0.12667, 0.25143, 0.07667, 0.06571, 8, 8, 3),
    ('sweatshirt', 'sleeve_left', 0.79667, 0.25143, 0.07667, 0.06571, 8, 8, 4),
    ('longsleeve', 'front', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0),
    ('longsleeve', 'back', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1),
    ('longsleeve', 'left_chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2),
    ('longsleeve', 'sleeve', 0.12667, 0.24286, 0.07667, 0.06571, 8, 8, 3),
    ('longsleeve', 'sleeve_left', 0.79667, 0.24286, 0.07667, 0.06571, 8, 8, 4)
  ) as a(type_code, code, x, y, w, h, cw, ch, s)
  join (values
    ('front', 'وسط الأمام', 'Front centre'),
    ('back', 'وسط الظهر', 'Back centre'),
    ('left_chest', 'الصدر الأيسر', 'Left chest'),
    ('sleeve', 'الكم الأيمن', 'Right sleeve'),
    ('sleeve_left', 'الكم الأيسر', 'Left sleeve')
  ) as n(code, name_ar, name_en) on n.code = a.code
  join public.product_types t on t.code = a.type_code
  join public.product_type_views v on v.product_type_id = t.id and v.code = case when a.code = 'back' then 'back' else 'front' end
on conflict (view_id, code) do nothing;

-- black & white as default colours of the built-in types (only where none are set yet)
update public.product_types
   set default_color_ids = array(select id from public.colors where code in ('black', 'white') order by sort_order)
 where default_color_ids = '{}' and garment_shape is not null;

-- the switch for customers uploading their OWN designs in "Design your piece" (on by default)
insert into public.website_settings (key, value) values ('designer', '{"customer_uploads": true}'::jsonb)
on conflict (key) do update set value = jsonb_build_object('customer_uploads', true) || website_settings.value;
