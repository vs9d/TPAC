-- =====================================================================
-- TPAC: Product printing configuration.
--   product_types       — templates (hoodie, T-shirt, …) the admin can add without code changes
--   product_type_views  — angles of a type, each with its own blank mockup (+ optional per-colour mockups)
--   product_print_areas — printable rectangles on a view (fractions of the mockup) with max size in cm
--   product_designs     — the official artwork the ADMIN placed inside an area for a product
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and length(code) <= 40),
  name_ar text not null check (length(name_ar) between 1 and 80),
  name_en text not null check (length(name_en) between 1 and 80),
  description_ar text check (description_ar is null or length(description_ar) <= 500),
  description_en text check (description_en is null or length(description_en) <= 500),
  -- built-in vector drawing used when no mockup photo has been uploaded yet (null for brand-new types)
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
  -- intrinsic pixel size of the mockup: keeps the preview frame and the print areas in proportion
  mockup_width int not null default 600 check (mockup_width between 50 and 10000),
  mockup_height int not null default 700 check (mockup_height between 50 and 10000),
  -- { "<color uuid>": { "url": "...", "path": "..." } } — a blank of the garment in that colour
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
  -- position and size on the mockup, as fractions of its width / height
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
  -- placement INSIDE the print area, as fractions of the area: a design can never exceed the printable size
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

-- product photos rendered from the mockup + design (replaced, never duplicated, when the design changes)
alter table public.product_images add column if not exists view_id uuid references public.product_type_views(id) on delete set null;
alter table public.product_images add column if not exists is_generated boolean not null default false;

drop trigger if exists product_types_updated on public.product_types;
create trigger product_types_updated before update on public.product_types for each row execute function public.set_updated_at();
drop trigger if exists product_designs_updated on public.product_designs;
create trigger product_designs_updated before update on public.product_designs for each row execute function public.set_updated_at();

alter table public.product_types enable row level security;
alter table public.product_type_views enable row level security;
alter table public.product_print_areas enable row level security;
alter table public.product_designs enable row level security;
drop policy if exists product_types_read on public.product_types;
drop policy if exists product_types_write on public.product_types;
drop policy if exists product_type_views_read on public.product_type_views;
drop policy if exists product_type_views_write on public.product_type_views;
drop policy if exists product_print_areas_read on public.product_print_areas;
drop policy if exists product_print_areas_write on public.product_print_areas;
drop policy if exists product_designs_read on public.product_designs;
drop policy if exists product_designs_write on public.product_designs;
create policy product_types_read on public.product_types for select to anon, authenticated using (is_active or public.is_staff());
create policy product_types_write on public.product_types for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy product_type_views_read on public.product_type_views for select to anon, authenticated using (is_active or public.is_staff());
create policy product_type_views_write on public.product_type_views for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy product_print_areas_read on public.product_print_areas for select to anon, authenticated using (is_active or public.is_staff());
create policy product_print_areas_write on public.product_print_areas for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- official artwork: visible with its (published) product; only staff can add, move, replace or remove it
create policy product_designs_read on public.product_designs for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_published or public.is_staff())));
create policy product_designs_write on public.product_designs for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- the customer print studio (customers uploading THEIR OWN artwork) can be switched off by the admin
insert into public.website_settings (key, value) values ('designer', '{"customer_uploads": true}'::jsonb)
on conflict (key) do update set value = jsonb_build_object('customer_uploads', true) || public.website_settings.value;

-- built-in types, laid out like the vector garments (upload real mockup photos from the dashboard)
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, default_color_ids, sort_order)
values ('tshirt', 'تيشيرت', 'T-shirt', 'tshirt', 20000, array(select id from public.colors where code in ('black', 'white')), 1)
on conflict (code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'front', 'الأمام', 'Front', 600, 700, 0 from public.product_types where code = 'tshirt'
on conflict (product_type_id, code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'back', 'الخلف', 'Back', 600, 700, 1 from public.product_types where code = 'tshirt'
on conflict (product_type_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'front', 'وسط الأمام', 'Front centre', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'tshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'back', 'وسط الظهر', 'Back centre', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'tshirt' and v.code = 'back'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'left_chest', 'الصدر الأيسر', 'Left chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'tshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve', 'الكم الأيمن', 'Right sleeve', 0.10333, 0.21429, 0.08667, 0.07429, 8, 8, 3
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'tshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve_left', 'الكم الأيسر', 'Left sleeve', 0.81000, 0.21429, 0.08667, 0.07429, 8, 8, 4
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'tshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, default_color_ids, sort_order)
values ('oversized', 'تيشيرت أوفرسايز', 'Oversized tee', 'oversized', 25000, array(select id from public.colors where code in ('black', 'white')), 2)
on conflict (code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'front', 'الأمام', 'Front', 600, 700, 0 from public.product_types where code = 'oversized'
on conflict (product_type_id, code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'back', 'الخلف', 'Back', 600, 700, 1 from public.product_types where code = 'oversized'
on conflict (product_type_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'front', 'وسط الأمام', 'Front centre', 0.32000, 0.21429, 0.36000, 0.42857, 32, 42, 0
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'oversized' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'back', 'وسط الظهر', 'Back centre', 0.30667, 0.18286, 0.38667, 0.48571, 34, 48, 1
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'oversized' and v.code = 'back'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'left_chest', 'الصدر الأيسر', 'Left chest', 0.58667, 0.20000, 0.12000, 0.10286, 10, 10, 2
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'oversized' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve', 'الكم الأيمن', 'Right sleeve', 0.06667, 0.28571, 0.09333, 0.08000, 8, 8, 3
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'oversized' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve_left', 'الكم الأيسر', 'Left sleeve', 0.84000, 0.28571, 0.09333, 0.08000, 8, 8, 4
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'oversized' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, default_color_ids, sort_order)
values ('hoodie', 'هودي', 'Hoodie', 'hoodie', 40000, array(select id from public.colors where code in ('black', 'white')), 3)
on conflict (code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'front', 'الأمام', 'Front', 600, 700, 0 from public.product_types where code = 'hoodie'
on conflict (product_type_id, code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'back', 'الخلف', 'Back', 600, 700, 1 from public.product_types where code = 'hoodie'
on conflict (product_type_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'front', 'وسط الأمام', 'Front centre', 0.34000, 0.27143, 0.32000, 0.31429, 28, 30, 0
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'hoodie' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'back', 'وسط الظهر', 'Back centre', 0.31667, 0.33714, 0.36667, 0.41429, 32, 40, 1
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'hoodie' and v.code = 'back'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'left_chest', 'الصدر الأيسر', 'Left chest', 0.58333, 0.25143, 0.10667, 0.09143, 10, 10, 2
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'hoodie' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve', 'الكم الأيمن', 'Right sleeve', 0.13333, 0.27143, 0.07667, 0.06571, 8, 8, 3
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'hoodie' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve_left', 'الكم الأيسر', 'Left sleeve', 0.79000, 0.27143, 0.07667, 0.06571, 8, 8, 4
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'hoodie' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, default_color_ids, sort_order)
values ('sweatshirt', 'سويتشيرت', 'Sweatshirt', 'sweatshirt', 35000, array(select id from public.colors where code in ('black', 'white')), 4)
on conflict (code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'front', 'الأمام', 'Front', 600, 700, 0 from public.product_types where code = 'sweatshirt'
on conflict (product_type_id, code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'back', 'الخلف', 'Back', 600, 700, 1 from public.product_types where code = 'sweatshirt'
on conflict (product_type_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'front', 'وسط الأمام', 'Front centre', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'sweatshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'back', 'وسط الظهر', 'Back centre', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'sweatshirt' and v.code = 'back'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'left_chest', 'الصدر الأيسر', 'Left chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'sweatshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve', 'الكم الأيمن', 'Right sleeve', 0.12667, 0.25143, 0.07667, 0.06571, 8, 8, 3
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'sweatshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve_left', 'الكم الأيسر', 'Left sleeve', 0.79667, 0.25143, 0.07667, 0.06571, 8, 8, 4
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'sweatshirt' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_types (code, name_ar, name_en, garment_shape, default_price, default_color_ids, sort_order)
values ('longsleeve', 'كم طويل', 'Long sleeve', 'longsleeve', 28000, array(select id from public.colors where code in ('black', 'white')), 5)
on conflict (code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'front', 'الأمام', 'Front', 600, 700, 0 from public.product_types where code = 'longsleeve'
on conflict (product_type_id, code) do nothing;
insert into public.product_type_views (product_type_id, code, name_ar, name_en, mockup_width, mockup_height, sort_order)
select id, 'back', 'الخلف', 'Back', 600, 700, 1 from public.product_types where code = 'longsleeve'
on conflict (product_type_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'front', 'وسط الأمام', 'Front centre', 0.33000, 0.21429, 0.34000, 0.40000, 30, 40, 0
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'longsleeve' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'back', 'وسط الظهر', 'Back centre', 0.32000, 0.18571, 0.36000, 0.45714, 32, 45, 1
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'longsleeve' and v.code = 'back'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'left_chest', 'الصدر الأيسر', 'Left chest', 0.58667, 0.20000, 0.11667, 0.10000, 10, 10, 2
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'longsleeve' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve', 'الكم الأيمن', 'Right sleeve', 0.12667, 0.24286, 0.07667, 0.06571, 8, 8, 3
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'longsleeve' and v.code = 'front'
on conflict (view_id, code) do nothing;
insert into public.product_print_areas (view_id, code, name_ar, name_en, x, y, width, height, max_width_cm, max_height_cm, sort_order)
select v.id, 'sleeve_left', 'الكم الأيسر', 'Left sleeve', 0.79667, 0.24286, 0.07667, 0.06571, 8, 8, 4
  from public.product_type_views v join public.product_types t on t.id = v.product_type_id
 where t.code = 'longsleeve' and v.code = 'front'
on conflict (view_id, code) do nothing;

-- default colours for the built-in types (black & white where those colours exist)
do $$ begin
  if to_regclass('public.product_types') is not null then
    update public.product_types set default_color_ids = array(select id from public.colors where code in ('black', 'white') order by sort_order)
     where default_color_ids = '{}' and garment_shape is not null;
  end if;
end $$;

-- repair: an earlier dashboard version saved placement codes with "-" (left-chest, sleeve-left)
update public.product_print_areas a set code = replace(a.code, '-', '_')
 where a.code in ('left-chest', 'sleeve-left')
   and not exists (select 1 from public.product_print_areas b where b.view_id = a.view_id and b.code = replace(a.code, '-', '_'));
