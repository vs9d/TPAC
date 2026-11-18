-- TPAC setup step 1/2: database structure. Supabase → SQL Editor → paste → Run.

-- ===== supabase/migrations/20261117000001_schema.sql =====
-- =====================================================================
-- TPAC e-commerce platform — core schema
-- All monetary amounts are stored as integer IQD (Iraqi dinar has no
-- fractional unit in practice).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('customer', 'staff', 'admin');

create type public.order_status as enum (
  'received',        -- Order received
  'confirmed',       -- Order confirmed
  'preparing',       -- Preparing
  'printing',        -- Printing
  'quality_check',   -- Quality inspection
  'ready_to_ship',   -- Ready for shipping
  'shipped',         -- Shipped
  'delivered',       -- Delivered
  'cancelled'        -- Cancelled
);

create type public.delivery_method as enum ('standard', 'express', 'pickup');
create type public.payment_method as enum ('cod', 'online');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded', 'failed');
create type public.discount_type as enum ('percent', 'fixed', 'free_shipping');
create type public.inventory_reason as enum ('initial', 'adjustment', 'sale', 'cancellation', 'return', 'restock', 'damage');
create type public.bulk_request_status as enum ('new', 'contacted', 'quoted', 'approved', 'rejected', 'converted');
create type public.quotation_status as enum ('draft', 'sent', 'approved', 'rejected', 'converted', 'expired');
create type public.notification_channel as enum ('in_app', 'email', 'whatsapp');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');
create type public.notification_audience as enum ('customer', 'admin');

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Normalise Iraqi mobile numbers to E.164 without "+": 9647XXXXXXXXX
create or replace function public.normalize_iraqi_phone(p text)
returns text language plpgsql immutable as $$
declare
  d text;
begin
  if p is null then return null; end if;
  -- convert Arabic-Indic and Eastern Arabic-Indic digits
  d := translate(p, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  d := regexp_replace(d, '[^0-9]', '', 'g');
  if d like '00964%' then d := substr(d, 3); end if;
  if d like '964%' then d := substr(d, 4); end if;
  if d like '0%' then d := substr(d, 2); end if;
  if d ~ '^7[0-9]{9}$' then
    return '964' || d;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Users / customers
-- "users" are Supabase auth.users; profile data lives here.
-- ---------------------------------------------------------------------
create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role public.user_role not null default 'customer',
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_profiles_phone_idx on public.customer_profiles(phone);
create index customer_profiles_role_idx on public.customer_profiles(role) where role <> 'customer';
create trigger customer_profiles_updated before update on public.customer_profiles
  for each row execute function public.set_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  governorate text not null,
  city text not null,
  address_line text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);
create unique index addresses_one_default on public.addresses(user_id) where is_default;
create trigger addresses_updated before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  image_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  featured_from timestamptz,
  featured_until timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  name_ar text not null,
  name_en text not null,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0
);

create table public.sizes (
  code text primary key check (code ~ '^[A-Z0-9]{1,6}$'),
  label text not null,
  sort_order int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  material_ar text,
  material_en text,
  printing_ar text,
  printing_en text,
  category_id uuid references public.categories(id) on delete set null,
  base_price int not null check (base_price >= 0),
  compare_at_price int check (compare_at_price is null or compare_at_price >= 0),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_limited boolean not null default false,
  is_customizable boolean not null default false,
  sales_count int not null default 0,
  tags text[] not null default '{}',
  seo_title_ar text,
  seo_title_en text,
  seo_description_ar text,
  seo_description_en text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create index products_published_idx on public.products(is_published, created_at desc);
create index products_sales_idx on public.products(sales_count desc);
create index products_name_ar_trgm on public.products using gin (name_ar gin_trgm_ops);
create index products_name_en_trgm on public.products using gin (name_en gin_trgm_ops);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, collection_id)
);
create index product_collections_collection_idx on public.product_collections(collection_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_ar text,
  alt_en text,
  color_id uuid references public.colors(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size_code text not null references public.sizes(code) on update cascade,
  color_id uuid not null references public.colors(id),
  price_override int check (price_override is null or price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_code, color_id)
);
create index product_variants_product_idx on public.product_variants(product_id);
create trigger product_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);
create index inventory_low_idx on public.inventory(quantity);
create trigger inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.inventory_transactions (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  change int not null,
  quantity_after int not null,
  reason public.inventory_reason not null,
  order_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_transactions_variant_idx on public.inventory_transactions(variant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Customisation (custom design tool)
-- ---------------------------------------------------------------------
create table public.custom_garment_types (
  code text primary key check (code ~ '^[a-z_]+$'),
  name_ar text not null,
  name_en text not null,
  base_price int not null check (base_price >= 0),
  color_ids uuid[] not null default '{}',
  sizes text[] not null default '{S,M,L,XL,XXL}',
  print_locations text[] not null default '{front,back,left_chest,sleeve}',
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.print_locations (
  code text primary key check (code in ('front', 'back', 'left_chest', 'sleeve')),
  name_ar text not null,
  name_en text not null,
  price int not null check (price >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.custom_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  garment_type text not null references public.custom_garment_types(code),
  color_id uuid not null references public.colors(id),
  size_code text not null references public.sizes(code),
  print_locations text[] not null,
  config jsonb not null,
  preview_front_path text,
  preview_back_path text,
  unit_price int not null check (unit_price >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index custom_designs_user_idx on public.custom_designs(user_id);

-- ---------------------------------------------------------------------
-- Bulk / university orders
-- ---------------------------------------------------------------------
create sequence public.bulk_request_number_seq start 1001;
create sequence public.quotation_number_seq start 1001;

create table public.bulk_order_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('BR-' || nextval('public.bulk_request_number_seq')),
  user_id uuid references auth.users(id) on delete set null,
  organization_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  product_type text not null,
  estimated_quantity int not null check (estimated_quantity > 0),
  size_breakdown jsonb not null default '{}'::jsonb,
  printing_requirements text,
  notes text,
  status public.bulk_request_status not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bulk_order_requests_status_idx on public.bulk_order_requests(status, created_at desc);
create trigger bulk_order_requests_updated before update on public.bulk_order_requests
  for each row execute function public.set_updated_at();

create table public.bulk_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  min_quantity int not null check (min_quantity > 0),
  max_quantity int check (max_quantity is null or max_quantity >= min_quantity),
  unit_price int not null check (unit_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index bulk_pricing_rules_type_idx on public.bulk_pricing_rules(product_type, min_quantity);

create table public.uploaded_artwork (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  bucket text not null default 'design-uploads',
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0),
  width int,
  height int,
  original_name text,
  custom_design_id uuid references public.custom_designs(id) on delete set null,
  bulk_request_id uuid references public.bulk_order_requests(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index uploaded_artwork_design_idx on public.uploaded_artwork(custom_design_id);
create index uploaded_artwork_bulk_idx on public.uploaded_artwork(bulk_request_id);

-- ---------------------------------------------------------------------
-- Delivery, discounts
-- ---------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null unique check (governorate ~ '^[a-z_]+$'),
  name_ar text not null,
  name_en text not null,
  standard_fee int not null check (standard_fee >= 0),
  express_fee int check (express_fee is null or express_fee >= 0),
  pickup_available boolean not null default false,
  estimated_days_min int not null default 1,
  estimated_days_max int not null default 3,
  free_shipping_threshold int,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  type public.discount_type not null,
  value int not null default 0 check (value >= 0),
  min_order_total int not null default 0 check (min_order_total >= 0),
  max_discount int,
  max_uses int check (max_uses is null or max_uses > 0),
  max_uses_per_customer int check (max_uses_per_customer is null or max_uses_per_customer > 0),
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type <> 'percent' or value between 1 and 100)
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TP' || nextval('public.order_number_seq')),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  governorate text not null,
  city text not null,
  address_line text not null,
  delivery_notes text,
  delivery_method public.delivery_method not null default 'standard',
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'unpaid',
  payment_reference text,
  status public.order_status not null default 'received',
  subtotal int not null check (subtotal >= 0),
  discount_total int not null default 0 check (discount_total >= 0),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  total int not null check (total >= 0),
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  discount_code text,
  locale text not null default 'ar',
  source text not null default 'web' check (source in ('web', 'bulk', 'admin')),
  quotation_id uuid,
  stock_committed boolean not null default false,
  has_custom_items boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_phone_idx on public.orders(phone);
create index orders_created_idx on public.orders(created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.inventory_transactions
  add constraint inventory_transactions_order_fk foreign key (order_id) references public.orders(id) on delete set null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  custom_design_id uuid references public.custom_designs(id) on delete set null,
  name_ar text not null,
  name_en text not null,
  sku text,
  size_code text,
  color_name_ar text,
  color_name_en text,
  color_hex text,
  image_url text,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total int not null check (line_total >= 0),
  check (variant_id is not null or custom_design_id is not null or product_id is null)
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table public.order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_notes_order_idx on public.order_notes(order_id);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default ('Q-' || nextval('public.quotation_number_seq')),
  bulk_request_id uuid not null references public.bulk_order_requests(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  subtotal int not null default 0 check (subtotal >= 0),
  discount int not null default 0 check (discount >= 0),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  total int not null default 0 check (total >= 0),
  valid_until date,
  status public.quotation_status not null default 'draft',
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotations_request_idx on public.quotations(bulk_request_id);
create trigger quotations_updated before update on public.quotations
  for each row execute function public.set_updated_at();

alter table public.orders
  add constraint orders_quotation_fk foreign key (quotation_id) references public.quotations(id) on delete set null;

create table public.discount_usage (
  id bigint generated always as identity primary key,
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  phone text,
  amount int not null,
  created_at timestamptz not null default now(),
  unique (discount_code_id, order_id)
);
create index discount_usage_code_user_idx on public.discount_usage(discount_code_id, user_id);
create index discount_usage_code_phone_idx on public.discount_usage(discount_code_id, phone);

-- ---------------------------------------------------------------------
-- Carts (persisted for signed-in customers; guests use local storage)
-- ---------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_updated before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  custom_design_id uuid references public.custom_designs(id) on delete cascade,
  quantity int not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  check ((variant_id is null) <> (custom_design_id is null))
);
create unique index cart_items_variant_uniq on public.cart_items(cart_id, variant_id) where variant_id is not null;
create unique index cart_items_design_uniq on public.cart_items(cart_id, custom_design_id) where custom_design_id is not null;

-- ---------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  rating int not null check (rating between 1 and 5),
  body text check (body is null or length(body) <= 2000),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews(product_id) where is_approved;

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale text not null default 'ar',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  message text not null check (length(message) <= 4000),
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Marketing / CMS
-- ---------------------------------------------------------------------
create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('announcement', 'hero', 'promo')),
  title_ar text,
  title_en text,
  subtitle_ar text,
  subtitle_en text,
  cta_label_ar text,
  cta_label_en text,
  link text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  collection_id uuid references public.collections(id) on delete set null,
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  banner_id uuid references public.promo_banners(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.homepage_sections (
  key text primary key check (key ~ '^[a-z_]+$'),
  title_ar text,
  title_en text,
  subtitle_ar text,
  subtitle_en text,
  body_ar text,
  body_en text,
  image_url text,
  cta_label_ar text,
  cta_label_en text,
  cta_href text,
  data jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger homepage_sections_updated before update on public.homepage_sections
  for each row execute function public.set_updated_at();

create table public.website_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger website_settings_updated before update on public.website_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience public.notification_audience not null,
  user_id uuid references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  channel public.notification_channel not null,
  event text not null,
  recipient text,
  title text not null,
  body text,
  link text,
  status public.notification_status not null default 'pending',
  error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_admin_idx on public.notifications(audience, channel, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_pending_idx on public.notifications(status) where status = 'pending';

create table public.admin_activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_activity_logs_created_idx on public.admin_activity_logs(created_at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- ===== supabase/migrations/20261117000002_functions.sql =====
-- =====================================================================
-- TPAC — business logic functions
-- Critical money / stock operations run inside single transactions in
-- Postgres so they can never be partially applied or raced.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation)
-- ---------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.customer_profiles where id = auth.uid()), 'customer'::public.user_role)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customer_profiles where id = auth.uid() and role in ('staff', 'admin'))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customer_profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customer_profiles (id, email, full_name, phone, preferred_locale)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    public.normalize_iraqi_phone(new.raw_user_meta_data ->> 'phone'),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'ar' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their own profile but never their role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    -- service_role (no auth.uid) or an admin may change roles
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'not_authorized: only admins can change roles' using errcode = '42501';
    end if;
    if auth.uid() is not null and auth.uid() = new.id and new.role <> 'admin' then
      raise exception 'admins cannot demote themselves' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger customer_profiles_protect_role before update on public.customer_profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Admin activity log
-- ---------------------------------------------------------------------
create or replace function public.log_admin_activity(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, shared across all app instances)
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- Order status workflow
-- ---------------------------------------------------------------------
create or replace function public.order_status_rank(s public.order_status)
returns int language sql immutable as $$
  select case s
    when 'received' then 1 when 'confirmed' then 2 when 'preparing' then 3
    when 'printing' then 4 when 'quality_check' then 5 when 'ready_to_ship' then 6
    when 'shipped' then 7 when 'delivered' then 8 when 'cancelled' then 99 end
$$;

-- Forward-only moves (steps may be skipped, e.g. no printing for stock
-- items). Cancellation is allowed until delivery. Terminal states are final.
create or replace function public.can_transition_order(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case
    when p_from in ('delivered', 'cancelled') then false
    when p_to = 'cancelled' then true
    else public.order_status_rank(p_to) > public.order_status_rank(p_from)
  end
$$;

-- ---------------------------------------------------------------------
-- Cart pricing — the single source of truth for prices, discounts,
-- delivery fees and stock availability. Used both for previews and
-- inside place_order().
-- payload: {
--   items: [{variant_id, quantity} | {custom_design_id, quantity}],
--   discount_code, governorate, delivery_method, user_id, phone
-- }
-- ---------------------------------------------------------------------
create or replace function public.quote_cart(payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_qty int;
  v_line jsonb;
  r record;
  d record;
  z record;
  v_discount int := 0;
  v_discount_info jsonb := null;
  v_delivery_fee int := 0;
  v_delivery_info jsonb := null;
  v_method text := coalesce(payload ->> 'delivery_method', 'standard');
  v_code text := upper(nullif(trim(payload ->> 'discount_code'), ''));
  v_user uuid := nullif(payload ->> 'user_id', '')::uuid;
  v_phone text := public.normalize_iraqi_phone(payload ->> 'phone');
  v_free_shipping boolean := false;
  v_uses int;
  v_min_order int := coalesce((select (value ->> 'min_order_total')::int from public.website_settings where key = 'checkout'), 0);
  v_has_custom boolean := false;
  v_seen jsonb := '{}'::jsonb;
  v_key text;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty_cart');
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) > 50 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    v_key := coalesce(v_item ->> 'variant_id', v_item ->> 'custom_design_id', '');
    if v_seen ? v_key then
      raise exception 'duplicate_cart_line' using errcode = '22023';
    end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);

    if v_item ? 'variant_id' and v_item ->> 'variant_id' is not null then
      select v.id as variant_id, v.sku, v.size_code, p.id as product_id, p.slug, p.name_ar, p.name_en,
             coalesce(v.price_override, p.base_price) as unit_price,
             c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex,
             coalesce(i.quantity, 0) as stock,
             (v.is_active and p.is_published) as sellable,
             (select pi.url from public.product_images pi
               where pi.product_id = p.id and (pi.color_id = v.color_id or pi.color_id is null)
               order by (pi.color_id = v.color_id) desc nulls last, pi.sort_order limit 1) as image_url
        into r
        from public.product_variants v
        join public.products p on p.id = v.product_id
        join public.colors c on c.id = v.color_id
        left join public.inventory i on i.variant_id = v.id
       where v.id = (v_item ->> 'variant_id')::uuid;

      if not found or not r.sellable then
        v_line := jsonb_build_object('variant_id', v_item ->> 'variant_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'variant_id', v_item ->> 'variant_id');
      else
        v_line := jsonb_build_object(
          'variant_id', r.variant_id, 'product_id', r.product_id, 'slug', r.slug, 'sku', r.sku,
          'name_ar', r.name_ar, 'name_en', r.name_en, 'size_code', r.size_code,
          'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en, 'color_hex', r.color_hex,
          'image_url', r.image_url, 'unit_price', r.unit_price, 'quantity', v_qty,
          'available', r.stock, 'line_total', r.unit_price * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'variant_id', r.variant_id);
        elsif v_qty > r.stock then
          v_line := v_line || jsonb_build_object('error', 'insufficient_stock');
          v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'variant_id', r.variant_id, 'available', r.stock);
        else
          v_subtotal := v_subtotal + r.unit_price * v_qty;
        end if;
      end if;

    elsif v_item ? 'custom_design_id' and v_item ->> 'custom_design_id' is not null then
      select cd.id, cd.unit_price, cd.size_code, cd.preview_front_path, cd.print_locations,
             g.name_ar, g.name_en, c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex
        into r
        from public.custom_designs cd
        join public.custom_garment_types g on g.code = cd.garment_type
        join public.colors c on c.id = cd.color_id
       where cd.id = (v_item ->> 'custom_design_id')::uuid
         and (cd.user_id is null or cd.user_id = v_user);
      if not found then
        v_line := jsonb_build_object('custom_design_id', v_item ->> 'custom_design_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'custom_design_id', v_item ->> 'custom_design_id');
      else
        v_has_custom := true;
        v_line := jsonb_build_object(
          'custom_design_id', r.id, 'name_ar', r.name_ar || ' — تصميم خاص', 'name_en', 'Custom ' || r.name_en,
          'size_code', r.size_code, 'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en,
          'color_hex', r.color_hex, 'preview_path', r.preview_front_path, 'print_locations', to_jsonb(r.print_locations),
          'unit_price', r.unit_price, 'quantity', v_qty, 'line_total', r.unit_price * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'custom_design_id', r.id);
        else
          v_subtotal := v_subtotal + r.unit_price * v_qty;
        end if;
      end if;
    else
      raise exception 'invalid_cart_line' using errcode = '22023';
    end if;
    v_lines := v_lines || jsonb_build_array(v_line);
  end loop;

  -- Discount code ---------------------------------------------------
  if v_code is not null then
    select * into d from public.discount_codes where code = v_code;
    if not found or not d.is_active then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'invalid_code');
    elsif d.starts_at is not null and d.starts_at > now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'not_started');
    elsif d.ends_at is not null and d.ends_at < now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'expired');
    elsif d.max_uses is not null and d.used_count >= d.max_uses then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'usage_limit');
    elsif v_subtotal < d.min_order_total then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'min_order', 'min_order_total', d.min_order_total);
    else
      v_uses := 0;
      if d.max_uses_per_customer is not null and (v_user is not null or v_phone is not null) then
        select count(*) into v_uses from public.discount_usage u
         where u.discount_code_id = d.id
           and ((v_user is not null and u.user_id = v_user) or (v_phone is not null and u.phone = v_phone));
      end if;
      if d.max_uses_per_customer is not null and v_uses >= d.max_uses_per_customer then
        v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'already_used');
      else
        if d.type = 'percent' then
          v_discount := floor(v_subtotal * d.value / 100.0)::int;
        elsif d.type = 'fixed' then
          v_discount := least(d.value, v_subtotal);
        else
          v_free_shipping := true;
        end if;
        if d.max_discount is not null then v_discount := least(v_discount, d.max_discount); end if;
        v_discount_info := jsonb_build_object('code', v_code, 'valid', true, 'type', d.type, 'value', d.value, 'id', d.id);
      end if;
    end if;
  end if;

  -- Delivery --------------------------------------------------------
  if payload ->> 'governorate' is not null then
    select * into z from public.delivery_zones where governorate = payload ->> 'governorate' and is_active;
    if not found then
      v_delivery_info := jsonb_build_object('available', false, 'error', 'unsupported_governorate');
      v_errors := v_errors || jsonb_build_object('code', 'unsupported_governorate');
    elsif v_method = 'pickup' then
      if z.pickup_available then
        v_delivery_fee := 0;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'pickup');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'pickup_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'pickup_unavailable');
      end if;
    elsif v_method = 'express' then
      if z.express_fee is not null then
        v_delivery_fee := z.express_fee;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'express');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'express_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'express_unavailable');
      end if;
    elsif v_method = 'standard' then
      v_delivery_fee := z.standard_fee;
      if z.free_shipping_threshold is not null and (v_subtotal - v_discount) >= z.free_shipping_threshold then
        v_delivery_fee := 0;
      end if;
      v_delivery_info := jsonb_build_object('available', true, 'method', 'standard',
        'days_min', z.estimated_days_min, 'days_max', z.estimated_days_max);
    else
      raise exception 'invalid_delivery_method' using errcode = '22023';
    end if;
    if v_free_shipping and v_method <> 'pickup' then
      v_delivery_fee := 0;
    end if;
  end if;

  if v_subtotal > 0 and v_subtotal < v_min_order then
    v_errors := v_errors || jsonb_build_object('code', 'min_order_total', 'min_order_total', v_min_order);
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', greatest(v_subtotal - v_discount, 0) + v_delivery_fee,
    'discount', v_discount_info,
    'delivery', v_delivery_info,
    'has_custom_items', v_has_custom,
    'min_order_total', v_min_order,
    'errors', v_errors
  );
end $$;

-- ---------------------------------------------------------------------
-- Place an order atomically.
-- payload = quote_cart payload + customer: {customer_name, phone, email,
--   governorate, city, address_line, delivery_notes, payment_method, locale}
-- Stock is committed at placement (prevents overselling) and restored by
-- update_order_status() on cancellation.
-- ---------------------------------------------------------------------
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q jsonb;
  v_line jsonb;
  v_order public.orders;
  v_phone text := public.normalize_iraqi_phone(payload ->> 'phone');
  v_user uuid := nullif(payload ->> 'user_id', '')::uuid;
  v_new_qty int;
  v_code_id uuid;
begin
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if coalesce(trim(payload ->> 'customer_name'), '') = '' or coalesce(trim(payload ->> 'address_line'), '') = ''
     or coalesce(trim(payload ->> 'city'), '') = '' then
    raise exception 'missing_customer_fields' using errcode = '22023';
  end if;
  if coalesce(payload ->> 'payment_method', 'cod') not in ('cod', 'online') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  -- Lock stock rows in a stable order to avoid deadlocks between
  -- concurrent checkouts, then lock the discount code row.
  perform 1 from public.inventory
   where variant_id in (
     select (e ->> 'variant_id')::uuid from jsonb_array_elements(payload -> 'items') e where e ->> 'variant_id' is not null)
   order by variant_id
   for update;

  if nullif(trim(payload ->> 'discount_code'), '') is not null then
    perform 1 from public.discount_codes where code = upper(trim(payload ->> 'discount_code')) for update;
  end if;

  q := public.quote_cart(payload || jsonb_build_object('phone', v_phone));

  if jsonb_array_length(q -> 'errors') > 0 then
    raise exception 'cart_invalid: %', (q -> 'errors')::text using errcode = 'P0001';
  end if;
  if q -> 'discount' is not null and q -> 'discount' <> 'null'::jsonb and not (q -> 'discount' ->> 'valid')::boolean then
    raise exception 'discount_invalid: %', (q -> 'discount' ->> 'error') using errcode = 'P0001';
  end if;
  if q -> 'delivery' is null or q -> 'delivery' = 'null'::jsonb then
    raise exception 'missing_governorate' using errcode = '22023';
  end if;

  v_code_id := nullif(q -> 'discount' ->> 'id', '')::uuid;

  insert into public.orders (
    user_id, customer_name, phone, email, governorate, city, address_line, delivery_notes,
    delivery_method, payment_method, payment_status, status, subtotal, discount_total, delivery_fee, total,
    discount_code_id, discount_code, locale, source, stock_committed, has_custom_items)
  values (
    v_user, trim(payload ->> 'customer_name'), v_phone, nullif(trim(payload ->> 'email'), ''),
    payload ->> 'governorate', trim(payload ->> 'city'), trim(payload ->> 'address_line'),
    nullif(trim(payload ->> 'delivery_notes'), ''),
    coalesce(payload ->> 'delivery_method', 'standard')::public.delivery_method,
    coalesce(payload ->> 'payment_method', 'cod')::public.payment_method,
    case when payload ->> 'payment_method' = 'online' then 'pending'::public.payment_status else 'unpaid'::public.payment_status end,
    'received', (q ->> 'subtotal')::int, (q ->> 'discount_total')::int, (q ->> 'delivery_fee')::int, (q ->> 'total')::int,
    v_code_id, case when v_code_id is not null then q -> 'discount' ->> 'code' end,
    case when payload ->> 'locale' = 'en' then 'en' else 'ar' end, 'web', true, (q ->> 'has_custom_items')::boolean)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(q -> 'lines') loop
    insert into public.order_items (order_id, product_id, variant_id, custom_design_id, name_ar, name_en, sku, size_code,
      color_name_ar, color_name_en, color_hex, image_url, unit_price, quantity, line_total)
    values (v_order.id, nullif(v_line ->> 'product_id', '')::uuid, nullif(v_line ->> 'variant_id', '')::uuid,
      nullif(v_line ->> 'custom_design_id', '')::uuid, v_line ->> 'name_ar', v_line ->> 'name_en', v_line ->> 'sku',
      v_line ->> 'size_code', v_line ->> 'color_name_ar', v_line ->> 'color_name_en', v_line ->> 'color_hex',
      coalesce(v_line ->> 'image_url', v_line ->> 'preview_path'),
      (v_line ->> 'unit_price')::int, (v_line ->> 'quantity')::int, (v_line ->> 'line_total')::int);

    if v_line ->> 'variant_id' is not null then
      update public.inventory set quantity = quantity - (v_line ->> 'quantity')::int
       where variant_id = (v_line ->> 'variant_id')::uuid
       returning quantity into v_new_qty;
      insert into public.inventory_transactions (variant_id, change, quantity_after, reason, order_id, created_by)
      values ((v_line ->> 'variant_id')::uuid, -(v_line ->> 'quantity')::int, v_new_qty, 'sale', v_order.id, v_user);
      update public.products set sales_count = sales_count + (v_line ->> 'quantity')::int
       where id = (v_line ->> 'product_id')::uuid;
    end if;
  end loop;

  if v_code_id is not null then
    update public.discount_codes set used_count = used_count + 1 where id = v_code_id;
    insert into public.discount_usage (discount_code_id, order_id, user_id, phone, amount)
    values (v_code_id, v_order.id, v_user, v_phone, (q ->> 'discount_total')::int);
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'received', v_user);

  insert into public.notifications (audience, channel, event, title, body, order_id, link)
  values ('admin', 'in_app', 'order.created', 'طلب جديد ' || v_order.order_number,
          v_order.customer_name || ' — ' || v_order.total || ' IQD', v_order.id, '/admin/orders/' || v_order.id);
  if v_order.has_custom_items then
    insert into public.notifications (audience, channel, event, title, body, order_id, link)
    values ('admin', 'in_app', 'custom_design.created', 'طلب تصميم خاص ' || v_order.order_number,
            v_order.customer_name, v_order.id, '/admin/orders/' || v_order.id);
  end if;

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'total', v_order.total,
    'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'delivery_fee', v_order.delivery_fee);
end $$;

-- ---------------------------------------------------------------------
-- Staff: change order status (with inventory restoration on cancel)
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  it record;
  v_new_qty int;
  v_restored boolean := false;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not public.can_transition_order(o.status, p_status) then
    raise exception 'invalid_transition: % -> %', o.status, p_status using errcode = 'P0001';
  end if;

  -- Restore stock if cancelled before it left the warehouse.
  if p_status = 'cancelled' and o.stock_committed and public.order_status_rank(o.status) < public.order_status_rank('shipped') then
    for it in select variant_id, quantity from public.order_items where order_id = o.id and variant_id is not null order by variant_id loop
      update public.inventory set quantity = quantity + it.quantity where variant_id = it.variant_id
        returning quantity into v_new_qty;
      if found then
        insert into public.inventory_transactions (variant_id, change, quantity_after, reason, order_id, created_by, note)
        values (it.variant_id, it.quantity, v_new_qty, 'cancellation', o.id, auth.uid(), 'Order ' || o.order_number || ' cancelled');
      end if;
      update public.products p set sales_count = greatest(p.sales_count - it.quantity, 0)
        from public.product_variants v where v.id = it.variant_id and p.id = v.product_id;
    end loop;
    update public.orders set stock_committed = false where id = o.id;
    v_restored := true;
  end if;

  update public.orders set status = p_status,
    payment_status = case when p_status = 'delivered' and payment_method = 'cod' then 'paid'::public.payment_status else payment_status end
   where id = o.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (o.id, o.status, p_status, nullif(trim(p_note), ''), auth.uid());

  if o.user_id is not null then
    insert into public.notifications (audience, user_id, order_id, channel, event, title, body, link)
    values ('customer', o.user_id, o.id, 'in_app', 'order.status_changed',
            'تحديث على طلبك ' || o.order_number, p_status::text, '/account/orders/' || o.id);
  end if;

  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'order.status_changed', 'order', o.id::text,
          jsonb_build_object('from', o.status, 'to', p_status, 'stock_restored', v_restored));

  return jsonb_build_object('order_id', o.id, 'from', o.status, 'to', p_status, 'stock_restored', v_restored);
end $$;

-- ---------------------------------------------------------------------
-- Staff: inventory adjustments
-- ---------------------------------------------------------------------
create or replace function public.adjust_inventory(p_variant_id uuid, p_change int, p_reason public.inventory_reason, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_change = 0 then
    raise exception 'zero_change' using errcode = '22023';
  end if;
  if p_reason in ('sale', 'cancellation') then
    raise exception 'reason_reserved_for_orders' using errcode = '22023';
  end if;
  insert into public.inventory (variant_id, quantity) values (p_variant_id, 0) on conflict (variant_id) do nothing;
  update public.inventory set quantity = quantity + p_change where variant_id = p_variant_id
    returning quantity into v_qty;  -- the CHECK (quantity >= 0) constraint prevents negative stock
  insert into public.inventory_transactions (variant_id, change, quantity_after, reason, note, created_by)
  values (p_variant_id, p_change, v_qty, p_reason, nullif(trim(p_note), ''), auth.uid());
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'inventory.adjusted', 'variant', p_variant_id::text,
          jsonb_build_object('change', p_change, 'reason', p_reason, 'quantity_after', v_qty));
  return v_qty;
end $$;

-- Low stock alert (fires once when stock crosses the threshold)
create or replace function public.inventory_low_stock_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v record;
begin
  if new.quantity <= new.low_stock_threshold and (tg_op = 'INSERT' or old.quantity > old.low_stock_threshold) then
    select p.name_ar, p.id as product_id, pv.sku into v
      from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = new.variant_id;
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'inventory.low_stock', 'مخزون منخفض: ' || coalesce(v.name_ar, ''),
            coalesce(v.sku, '') || ' — ' || new.quantity, '/admin/inventory?q=' || coalesce(v.sku, ''));
  end if;
  return new;
end $$;

create trigger inventory_low_stock after insert or update of quantity on public.inventory
  for each row execute function public.inventory_low_stock_alert();

-- Admin alerts for new bulk requests / inquiries
create or replace function public.notify_admin_new_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'bulk_order_requests' then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'bulk_request.created', 'طلب جملة جديد ' || new.request_number,
            new.organization_name || ' — ' || new.estimated_quantity, '/admin/bulk/' || new.id);
  elsif tg_table_name = 'contact_inquiries' then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'inquiry.created', 'استفسار جديد من ' || new.name, left(new.message, 140), '/admin/inquiries');
  end if;
  return new;
end $$;

create trigger bulk_order_requests_notify after insert on public.bulk_order_requests
  for each row execute function public.notify_admin_new_record();
create trigger contact_inquiries_notify after insert on public.contact_inquiries
  for each row execute function public.notify_admin_new_record();

-- ---------------------------------------------------------------------
-- Public order tracking (order number + phone must both match)
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders
   where order_number = upper(trim(p_order_number))
     and phone = public.normalize_iraqi_phone(p_phone);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'delivery_method', o.delivery_method,
    'governorate', o.governorate,
    'city', o.city,
    'total', o.total,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'quantity', quantity,
                'size_code', size_code, 'color_name_ar', color_name_ar, 'color_name_en', color_name_en)), '[]'::jsonb)
              from public.order_items where order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', to_status, 'at', created_at) order by created_at), '[]'::jsonb)
                from public.order_status_history where order_id = o.id)
  );
end $$;

-- ---------------------------------------------------------------------
-- Bulk: quantity-based price lookup
-- ---------------------------------------------------------------------
create or replace function public.bulk_unit_price(p_product_type text, p_quantity int)
returns int language sql stable security definer set search_path = public as $$
  select unit_price from public.bulk_pricing_rules
   where is_active and product_type = p_product_type and min_quantity <= p_quantity
     and (max_quantity is null or max_quantity >= p_quantity)
   order by min_quantity desc limit 1
$$;

-- Staff: convert an approved quotation into a real order
create or replace function public.convert_quotation_to_order(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  qt public.quotations;
  br public.bulk_order_requests;
  v_order public.orders;
  it jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into qt from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'quotation_not_found' using errcode = 'P0002'; end if;
  if qt.status <> 'approved' then raise exception 'quotation_not_approved' using errcode = 'P0001'; end if;
  if jsonb_array_length(qt.items) = 0 then raise exception 'quotation_empty' using errcode = 'P0001'; end if;
  select * into br from public.bulk_order_requests where id = qt.bulk_request_id;

  insert into public.orders (user_id, customer_name, phone, email, governorate, city, address_line, delivery_notes,
    delivery_method, payment_method, status, subtotal, discount_total, delivery_fee, total, source, quotation_id, stock_committed)
  values (br.user_id, br.contact_name || ' — ' || br.organization_name, coalesce(public.normalize_iraqi_phone(br.phone), br.phone), br.email,
    'baghdad', '-', '-', 'Bulk order ' || br.request_number,
    'standard', 'cod', 'confirmed', qt.subtotal, qt.discount, qt.delivery_fee, qt.total, 'bulk', qt.id, false)
  returning * into v_order;

  for it in select * from jsonb_array_elements(qt.items) loop
    insert into public.order_items (order_id, name_ar, name_en, size_code, unit_price, quantity, line_total)
    values (v_order.id, coalesce(it ->> 'description', 'Bulk item'), coalesce(it ->> 'description', 'Bulk item'),
      it ->> 'size', (it ->> 'unit_price')::int, (it ->> 'quantity')::int, (it ->> 'unit_price')::int * (it ->> 'quantity')::int);
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (v_order.id, null, 'confirmed', 'Converted from quotation ' || qt.quote_number, auth.uid());
  update public.quotations set status = 'converted', order_id = v_order.id where id = qt.id;
  update public.bulk_order_requests set status = 'converted' where id = br.id;
  insert into public.admin_activity_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'quotation.converted', 'quotation', qt.id::text, jsonb_build_object('order_id', v_order.id));
  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number);
end $$;

-- ---------------------------------------------------------------------
-- Staff: dashboard metrics
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_orders', (select count(*) from public.orders where created_at between p_from and p_to),
    'pending_orders', (select count(*) from public.orders where status in ('received', 'confirmed', 'preparing', 'printing', 'quality_check', 'ready_to_ship')),
    'completed_orders', (select count(*) from public.orders where status = 'delivered' and created_at between p_from and p_to),
    'cancelled_orders', (select count(*) from public.orders where status = 'cancelled' and created_at between p_from and p_to),
    'total_sales', (select coalesce(sum(total), 0) from public.orders where status <> 'cancelled' and created_at between p_from and p_to),
    'revenue', (select coalesce(sum(total - delivery_fee), 0) from public.orders where status = 'delivered' and created_at between p_from and p_to),
    'customers', (select count(*) from public.customer_profiles where role = 'customer'),
    'new_bulk_requests', (select count(*) from public.bulk_order_requests where status = 'new'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'total', t, 'orders', c) order by d), '[]'::jsonb) from (
        select date_trunc('day', created_at)::date as d, sum(total) as t, count(*) as c
          from public.orders where status <> 'cancelled' and created_at between p_from and p_to group by 1) s),
    'best_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select oi.product_id, max(oi.name_ar) as name_ar, max(oi.name_en) as name_en, sum(oi.quantity) as units, sum(oi.line_total) as revenue
          from public.order_items oi join public.orders o on o.id = oi.order_id
         where o.status <> 'cancelled' and o.created_at between p_from and p_to and oi.product_id is not null
         group by oi.product_id order by sum(oi.quantity) desc limit 5) x),
    'low_stock', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select pv.id as variant_id, pv.sku, p.name_ar, p.name_en, i.quantity, i.low_stock_threshold
          from public.inventory i join public.product_variants pv on pv.id = i.variant_id join public.products p on p.id = pv.product_id
         where i.quantity <= i.low_stock_threshold and pv.is_active order by i.quantity asc limit 10) x)
  );
end $$;

-- ---------------------------------------------------------------------
-- Function privileges: nothing is callable by default.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.normalize_iraqi_phone(text) to anon, authenticated;
grant execute on function public.order_status_rank(public.order_status) to anon, authenticated;
grant execute on function public.can_transition_order(public.order_status, public.order_status) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.adjust_inventory(uuid, int, public.inventory_reason, text) to authenticated;
grant execute on function public.convert_quotation_to_order(uuid) to authenticated;
grant execute on function public.admin_dashboard_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.log_admin_activity(text, text, text, jsonb) to authenticated;
grant execute on function public.bulk_unit_price(text, int) to anon, authenticated;
-- quote_cart / place_order / check_rate_limit: service_role only (called from the server after validation)
grant execute on function public.quote_cart(jsonb) to service_role;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ===== supabase/migrations/20261117000003_rls.sql =====
-- =====================================================================
-- TPAC — Row Level Security
-- Principle: deny by default. Customers see only their own private data;
-- staff (role staff/admin) manage the store; settings & roles are admin-only.
-- Writes that involve money or stock go through SECURITY DEFINER
-- functions, never direct table writes from the browser.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'customer_profiles','addresses','categories','collections','colors','sizes','products','product_collections',
    'product_images','product_variants','inventory','inventory_transactions','custom_garment_types','print_locations',
    'custom_designs','bulk_order_requests','bulk_pricing_rules','uploaded_artwork','delivery_zones','discount_codes',
    'orders','order_items','order_status_history','order_notes','quotations','discount_usage','carts','cart_items',
    'reviews','favorites','newsletter_subscribers','contact_inquiries','promo_banners','campaigns','homepage_sections',
    'website_settings','notifications','admin_activity_logs','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Profiles & addresses
-- ---------------------------------------------------------------------
create policy profiles_select_own on public.customer_profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.customer_profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.addresses for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Public catalog (read), staff write
-- ---------------------------------------------------------------------
create policy categories_read on public.categories for select to anon, authenticated using (is_active or public.is_staff());
create policy categories_write on public.categories for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy collections_read on public.collections for select to anon, authenticated using (is_active or public.is_staff());
create policy collections_write on public.collections for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy colors_read on public.colors for select to anon, authenticated using (true);
create policy colors_write on public.colors for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy sizes_read on public.sizes for select to anon, authenticated using (true);
create policy sizes_write on public.sizes for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy products_read on public.products for select to anon, authenticated using (is_published or public.is_staff());
create policy products_write on public.products for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_collections_read on public.product_collections for select to anon, authenticated using (true);
create policy product_collections_write on public.product_collections for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_images_read on public.product_images for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and (p.is_published or public.is_staff())));
create policy product_images_write on public.product_images for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy product_variants_read on public.product_variants for select to anon, authenticated using (
  (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_published)) or public.is_staff());
create policy product_variants_write on public.product_variants for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Stock levels are public (needed to show availability); changes only through adjust_inventory()/place_order().
create policy inventory_read on public.inventory for select to anon, authenticated using (true);
create policy inventory_staff_insert on public.inventory for insert to authenticated with check (public.is_staff());
create policy inventory_staff_update_threshold on public.inventory for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy inventory_tx_read on public.inventory_transactions for select to authenticated using (public.is_staff());

create policy garment_types_read on public.custom_garment_types for select to anon, authenticated using (is_active or public.is_staff());
create policy garment_types_write on public.custom_garment_types for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy print_locations_read on public.print_locations for select to anon, authenticated using (is_active or public.is_staff());
create policy print_locations_write on public.print_locations for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Customisation & bulk
-- custom_designs / uploads / bulk requests are created by the server
-- (service role) after validation; customers can read their own.
-- ---------------------------------------------------------------------
create policy custom_designs_read on public.custom_designs for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy uploaded_artwork_read on public.uploaded_artwork for select to authenticated
  using (uploaded_by = auth.uid() or public.is_staff());

create policy bulk_requests_read on public.bulk_order_requests for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy bulk_requests_staff_update on public.bulk_order_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy bulk_requests_staff_delete on public.bulk_order_requests for delete to authenticated using (public.is_admin());

create policy bulk_pricing_read on public.bulk_pricing_rules for select to anon, authenticated using (is_active or public.is_staff());
create policy bulk_pricing_write on public.bulk_pricing_rules for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy quotations_staff on public.quotations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy quotations_customer_read on public.quotations for select to authenticated using (
  status in ('sent', 'approved', 'converted') and exists (
    select 1 from public.bulk_order_requests b where b.id = bulk_request_id and b.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Delivery & discounts
-- ---------------------------------------------------------------------
create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated using (is_active or public.is_staff());
create policy delivery_zones_write on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Discount codes are never listable by customers (validated server-side).
create policy discount_codes_staff on public.discount_codes for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy discount_usage_staff on public.discount_usage for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Orders — customers read their own; staff read/update. Inserts happen
-- only via place_order() / convert_quotation_to_order().
-- ---------------------------------------------------------------------
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy orders_staff_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy order_items_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

create policy order_history_read on public.order_status_history for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

create policy order_notes_staff on public.order_notes for all to authenticated using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());

-- Prevent staff from rewriting money columns or status directly (status must go through update_order_status()).
create or replace function public.guard_order_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.total is distinct from old.total or new.subtotal is distinct from old.subtotal
       or new.discount_total is distinct from old.discount_total or new.delivery_fee is distinct from old.delivery_fee
       or new.stock_committed is distinct from old.stock_committed or new.user_id is distinct from old.user_id
       or new.order_number is distinct from old.order_number then
      raise exception 'protected_order_columns' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger orders_guard before update on public.orders for each row execute function public.guard_order_update();

-- Same idea for inventory quantity: only via functions.
create or replace function public.guard_inventory_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.quantity is distinct from old.quantity then
    raise exception 'use_adjust_inventory' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger inventory_guard before update on public.inventory for each row execute function public.guard_inventory_update();

create or replace function public.guard_inventory_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.quantity <> 0 then
    raise exception 'use_adjust_inventory' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger inventory_guard_insert before insert on public.inventory for each row execute function public.guard_inventory_insert();

-- ---------------------------------------------------------------------
-- Carts, favourites, reviews
-- ---------------------------------------------------------------------
create policy carts_own on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy favorites_own on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reviews_read on public.reviews for select to anon, authenticated using (is_approved or user_id = auth.uid() or public.is_staff());
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid() and not is_approved);
create policy reviews_staff on public.reviews for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy reviews_delete on public.reviews for delete to authenticated using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- Marketing / CMS / settings
-- ---------------------------------------------------------------------
create policy newsletter_staff on public.newsletter_subscribers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy inquiries_staff on public.contact_inquiries for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy banners_read on public.promo_banners for select to anon, authenticated using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or public.is_staff());
create policy banners_write on public.promo_banners for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy campaigns_staff on public.campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy homepage_read on public.homepage_sections for select to anon, authenticated using (is_visible or public.is_staff());
create policy homepage_write on public.homepage_sections for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Settings are public configuration (no secrets are ever stored here). Only admins can change them.
create policy settings_read on public.website_settings for select to anon, authenticated using (true);
create policy settings_write on public.website_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Notifications & logs
-- ---------------------------------------------------------------------
create policy notifications_customer on public.notifications for select to authenticated using (
  (audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()));
create policy notifications_mark_read on public.notifications for update to authenticated using (
  (audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()))
  with check ((audience = 'customer' and user_id = auth.uid()) or (audience = 'admin' and public.is_staff()));

create policy activity_logs_staff_read on public.admin_activity_logs for select to authenticated using (public.is_staff());

-- rate_limits: no policies => no access except service_role.

-- Customers can only flip read_at on their notifications.
create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
      raise exception 'only_read_at_is_editable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.guard_notification_update();

-- ===== supabase/migrations/20261117000004_storage.sql =====
-- =====================================================================
-- TPAC — Storage buckets and policies
--  product-images : public read, staff write (catalog photography)
--  site-media     : public read, staff write (banners, campaign imagery)
--  design-uploads : PRIVATE. Customer artwork + design previews. Written
--                   only by the server (service role) after type/size
--                   validation; read by staff through signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-media', 'site-media', true, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('design-uploads', 'design-uploads', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public read catalog media" on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'site-media'));

create policy "staff write catalog media" on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'site-media') and public.is_staff());
create policy "staff update catalog media" on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'site-media') and public.is_staff());
create policy "staff delete catalog media" on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'site-media') and public.is_staff());

create policy "staff read design uploads" on storage.objects for select to authenticated
  using (bucket_id = 'design-uploads' and public.is_staff());

-- ===== supabase/migrations/20261117000005_catalog_search.sql =====
-- =====================================================================
-- TPAC — catalog search (SECURITY INVOKER: RLS still applies, so anonymous
-- visitors only ever see published products).
-- p = { q, category, collection, sizes[], colors[], min_price, max_price,
--       in_stock, new, best, limited, customizable, sort, limit, offset, exclude }
-- sort: newest | popular | price_asc | price_desc
-- =====================================================================
create or replace function public.catalog_search(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_q text := nullif(trim(p ->> 'q'), '');
  v_limit int := least(greatest(coalesce((p ->> 'limit')::int, 24), 1), 60);
  v_offset int := greatest(coalesce((p ->> 'offset')::int, 0), 0);
  v_sort text := coalesce(p ->> 'sort', 'newest');
  v_sizes text[] := case when jsonb_typeof(p -> 'sizes') = 'array' then array(select jsonb_array_elements_text(p -> 'sizes')) end;
  v_colors text[] := case when jsonb_typeof(p -> 'colors') = 'array' then array(select jsonb_array_elements_text(p -> 'colors')) end;
  v_result jsonb;
begin
  with base as (
    select pr.*,
           (select min(coalesce(v.price_override, pr.base_price)) from product_variants v where v.product_id = pr.id and v.is_active) as min_price
      from products pr
     where pr.is_published
       and (v_q is null or pr.name_ar ilike '%' || v_q || '%' or pr.name_en ilike '%' || v_q || '%'
            or exists (select 1 from unnest(pr.tags) t where t ilike '%' || v_q || '%')
            or exists (select 1 from categories c where c.id = pr.category_id and (c.name_ar ilike '%' || v_q || '%' or c.name_en ilike '%' || v_q || '%')))
       and (p ->> 'category' is null or pr.category_id in (
             select c.id from categories c where c.slug = p ->> 'category'
             union select c2.id from categories c2 join categories c1 on c2.parent_id = c1.id where c1.slug = p ->> 'category'))
       and (p ->> 'collection' is null or exists (
             select 1 from product_collections pc join collections co on co.id = pc.collection_id
              where pc.product_id = pr.id and co.slug = p ->> 'collection'))
       and (v_sizes is null or exists (select 1 from product_variants v where v.product_id = pr.id and v.is_active and v.size_code = any(v_sizes)))
       and (v_colors is null or exists (select 1 from product_variants v join colors c on c.id = v.color_id
             where v.product_id = pr.id and v.is_active and c.code = any(v_colors)))
       and (coalesce((p ->> 'in_stock')::boolean, false) = false or exists (
             select 1 from product_variants v join inventory i on i.variant_id = v.id
              where v.product_id = pr.id and v.is_active and i.quantity > 0
                and (v_sizes is null or v.size_code = any(v_sizes))))
       and (coalesce((p ->> 'new')::boolean, false) = false or pr.is_new_arrival)
       and (coalesce((p ->> 'best')::boolean, false) = false or pr.sales_count > 0 or pr.is_featured)
       and (coalesce((p ->> 'limited')::boolean, false) = false or pr.is_limited)
       and (coalesce((p ->> 'customizable')::boolean, false) = false or pr.is_customizable)
       and (p ->> 'exclude' is null or pr.id <> (p ->> 'exclude')::uuid)
  ), filtered as (
    select * from base
     where (p ->> 'min_price' is null or coalesce(min_price, base_price) >= (p ->> 'min_price')::int)
       and (p ->> 'max_price' is null or coalesce(min_price, base_price) <= (p ->> 'max_price')::int)
  ), ranked as (
    select f.*, row_number() over (order by
       case when v_sort = 'price_asc' then coalesce(f.min_price, f.base_price) end asc,
       case when v_sort = 'price_desc' then coalesce(f.min_price, f.base_price) end desc,
       case when v_sort = 'popular' then f.sales_count end desc,
       coalesce(f.published_at, f.created_at) desc, f.id) as rn
      from filtered f
  ), page as (
    select * from ranked where rn > v_offset and rn <= v_offset + v_limit
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'slug', pg.slug, 'name_ar', pg.name_ar, 'name_en', pg.name_en,
        'price', coalesce(pg.min_price, pg.base_price), 'compare_at_price', pg.compare_at_price,
        'is_new_arrival', pg.is_new_arrival, 'is_limited', pg.is_limited, 'is_customizable', pg.is_customizable,
        'images', coalesce((select jsonb_agg(jsonb_build_object('url', pi.url, 'alt_ar', pi.alt_ar, 'alt_en', pi.alt_en) order by pi.sort_order)
                              from (select * from product_images where product_id = pg.id order by sort_order limit 2) pi), '[]'::jsonb),
        'colors', coalesce((select jsonb_agg(distinct c.hex) from product_variants v join colors c on c.id = v.color_id
                              where v.product_id = pg.id and v.is_active), '[]'::jsonb),
        'in_stock', exists (select 1 from product_variants v join inventory i on i.variant_id = v.id
                             where v.product_id = pg.id and v.is_active and i.quantity > 0)
      ) order by pg.rn) from page pg), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

grant execute on function public.catalog_search(jsonb) to anon, authenticated, service_role;

-- ===== supabase/migrations/20261117000006_admin.sql =====
-- =====================================================================
-- TPAC — admin helpers
-- =====================================================================

-- Customers = registered profiles + guest buyers (grouped by phone), with
-- order statistics so repeat customers are easy to identify.
create or replace function public.admin_customers(p_search text default null, p_limit int default 50, p_offset int default 0, p_repeat_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(trim(p_search), '');
  v_phone text := public.normalize_iraqi_phone(p_search);
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  with registered as (
    select cp.id as user_id, cp.full_name as name, cp.phone, cp.email, cp.role::text as role, cp.created_at,
           count(o.id) filter (where o.status <> 'cancelled') as order_count,
           coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
           max(o.created_at) as last_order_at
      from customer_profiles cp
      left join orders o on o.user_id = cp.id or (o.user_id is null and cp.phone is not null and o.phone = cp.phone)
     group by cp.id
  ), guests as (
    select null::uuid as user_id, max(o.customer_name) as name, o.phone, max(o.email) as email, 'guest'::text as role, min(o.created_at) as created_at,
           count(*) filter (where o.status <> 'cancelled') as order_count,
           coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
           max(o.created_at) as last_order_at
      from orders o
     where o.user_id is null and not exists (select 1 from customer_profiles cp where cp.phone = o.phone)
     group by o.phone
  ), all_rows as (
    select * from registered union all select * from guests
  ), filtered as (
    select * from all_rows
     where (v_q is null or name ilike '%' || v_q || '%' or email ilike '%' || v_q || '%' or phone = v_phone
            or (length(regexp_replace(v_q, '[^0-9]', '', 'g')) >= 4 and phone like '%' || regexp_replace(v_q, '[^0-9]', '', 'g') || '%'))
       and (not p_repeat_only or order_count >= 2)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(f) order by f.last_order_at desc nulls last, f.created_at desc)
                         from (select * from filtered order by last_order_at desc nulls last, created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0)) f), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function public.admin_customers(text, int, int, boolean) from public, anon;
grant execute on function public.admin_customers(text, int, int, boolean) to authenticated;

-- ===== supabase/migrations/20261118000007_left_sleeve.sql =====
-- Adds a second sleeve placement: "sleeve" is the wearer's right sleeve,
-- "sleeve_left" the wearer's left sleeve. White becomes available for hoodies.
alter table public.print_locations drop constraint if exists print_locations_code_check;
alter table public.print_locations add constraint print_locations_code_check
  check (code in ('front', 'back', 'left_chest', 'sleeve', 'sleeve_left'));

insert into public.print_locations (code, name_ar, name_en, price, sort_order)
values ('sleeve_left', 'الكم الأيسر', 'Left sleeve', 3000, 4)
on conflict (code) do nothing;
update public.print_locations set name_ar = 'الكم الأيمن', name_en = 'Right sleeve' where code = 'sleeve';

update public.custom_garment_types
   set print_locations = array(select distinct unnest(print_locations || '{sleeve_left}'::text[]))
 where 'sleeve' = any(print_locations) and not ('sleeve_left' = any(print_locations));

update public.custom_garment_types
   set color_ids = array(select distinct unnest(color_ids || array(select id from public.colors where code = 'white')))
 where code = 'hoodie';

-- ===== supabase/migrations/20261118000008_store_reviews.sql =====
-- =====================================================================
-- Store-wide customer reviews ("آراء الزبائن"):
--  * reviews may be about the store in general (product_id null)
--  * guests can submit (user_id null) — always moderated before showing
--  * photos (customer uploads / admin-added screenshots), city, source,
--    verified-buyer flag (order number + phone matched) and featuring
-- =====================================================================
alter table public.reviews alter column product_id drop not null;
alter table public.reviews alter column user_id drop not null;
alter table public.reviews add column if not exists author_city text check (author_city is null or length(author_city) <= 80);
alter table public.reviews add column if not exists photos text[] not null default '{}';
alter table public.reviews add column if not exists source text not null default 'site' check (source in ('site', 'instagram', 'whatsapp', 'tiktok', 'other'));
alter table public.reviews add column if not exists is_verified boolean not null default false;
alter table public.reviews add column if not exists is_featured boolean not null default false;
alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.reviews drop constraint if exists reviews_photos_max;
alter table public.reviews add constraint reviews_photos_max check (coalesce(array_length(photos, 1), 0) <= 6);
create index if not exists reviews_public_idx on public.reviews (is_featured desc, created_at desc) where is_approved;

-- Aggregates for the reviews page header (approved only).
create or replace function public.review_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'with_photos', count(*) filter (where coalesce(array_length(photos, 1), 0) > 0),
    'by_rating', jsonb_build_object('5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
      '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2), '1', count(*) filter (where rating = 1)))
  from public.reviews where is_approved
$$;
grant execute on function public.review_stats() to anon, authenticated;

-- New reviews alert the admins.
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_approved then
    insert into public.notifications (audience, channel, event, title, body, link)
    values ('admin', 'in_app', 'review.created', 'رأي جديد بانتظار الموافقة: ' || coalesce(new.author_name, ''), left(coalesce(new.body, ''), 140), '/admin/reviews');
  end if;
  return new;
end $$;
drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_new_review();

-- Staff can add testimonials (published directly).
drop policy if exists reviews_staff_insert on public.reviews;
create policy reviews_staff_insert on public.reviews for insert to authenticated with check (public.is_staff());

-- ===== supabase/migrations/20261118000009_review_avatars.sql =====
-- Reviews page v2: customer profile photo + category label ("تيشيرتات", "طلبات خاصة"…)
-- and a satisfaction percentage (share of 4–5★ reviews) in review_stats().
alter table public.reviews add column if not exists avatar_url text check (avatar_url is null or length(avatar_url) <= 1000);
alter table public.reviews add column if not exists label text check (label is null or length(label) <= 40);

create or replace function public.review_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'satisfaction', case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where rating >= 4) / count(*)) end,
    'with_photos', count(*) filter (where coalesce(array_length(photos, 1), 0) > 0),
    'by_rating', jsonb_build_object('5', count(*) filter (where rating = 5), '4', count(*) filter (where rating = 4),
      '3', count(*) filter (where rating = 3), '2', count(*) filter (where rating = 2), '1', count(*) filter (where rating = 1)))
  from public.reviews where is_approved
$$;
grant execute on function public.review_stats() to anon, authenticated;

-- ===== supabase/migrations/20261118000010_hero_slider.sql =====
-- Hero slideshow: slides can carry a video (mp4/webm/mov), uploaded from the dashboard.
alter table public.promo_banners add column if not exists video_url text check (video_url is null or length(video_url) <= 1000);

-- site-media now accepts short videos (40 MB) next to images.
update storage.buckets
   set file_size_limit = 41943040,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'site-media';

-- ===== supabase/migrations/20261118000011_designer_pro.sql =====
-- =====================================================================
-- TPAC: Designer Pro — print options, quantity discounts, richer designs.
-- Supabase → SQL Editor → paste → Run. Safe to run more than once.
-- =====================================================================

-- 1) Designs: a name, a batch (one design ordered in several sizes), chosen options
alter table public.custom_designs add column if not exists name text check (name is null or length(name) <= 80);
alter table public.custom_designs add column if not exists batch_id uuid;
alter table public.custom_designs add column if not exists options jsonb not null default '{}'::jsonb;
alter table public.custom_designs add column if not exists options_price int not null default 0 check (options_price >= 0);
create index if not exists custom_designs_batch_idx on public.custom_designs(batch_id) where batch_id is not null;

-- 2) Print options managed from the dashboard (method / finish / fabric / package are single-choice, addon is multi-choice)
create table if not exists public.designer_options (
  id uuid primary key default gen_random_uuid(),
  group_code text not null check (group_code in ('method', 'finish', 'fabric', 'package', 'addon')),
  code text not null check (code ~ '^[a-z0-9_]{2,32}$'),
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  price int not null default 0 check (price >= 0 and price <= 1000000),
  is_default boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (group_code, code)
);

-- 3) Quantity discount for made-to-order pieces (applied by quote_cart on the total custom quantity)
create table if not exists public.designer_tiers (
  min_qty int primary key check (min_qty > 1 and min_qty <= 10000),
  discount_percent int not null check (discount_percent between 1 and 60),
  is_active boolean not null default true
);

alter table public.designer_options enable row level security;
alter table public.designer_tiers enable row level security;
drop policy if exists designer_options_read on public.designer_options;
drop policy if exists designer_options_write on public.designer_options;
drop policy if exists designer_tiers_read on public.designer_tiers;
drop policy if exists designer_tiers_write on public.designer_tiers;
create policy designer_options_read on public.designer_options for select to anon, authenticated using (is_active or public.is_staff());
create policy designer_options_write on public.designer_options for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy designer_tiers_read on public.designer_tiers for select to anon, authenticated using (is_active or public.is_staff());
create policy designer_tiers_write on public.designer_tiers for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 4) Starter data (only when empty, so your edits are never overwritten)
insert into public.designer_options (group_code, code, name_ar, name_en, description_ar, description_en, price, is_default, sort_order)
select * from (values
  ('method', 'dtf',        'طباعة DTF',        'DTF print',       'ألوان كاملة ودقة عالية، تناسب الصور والتفاصيل', 'Full colour, high detail — ideal for photos and artwork', 0, true, 1),
  ('method', 'vinyl',      'فينيل حراري',      'Heat-press vinyl','ألوان صلبة نظيفة للشعارات والنصوص',               'Clean solid colours for logos and lettering',          2000, false, 2),
  ('method', 'screen',     'سلك سكرين',        'Screen print',    'الأفضل للكميات الكبيرة وألوان محدودة',            'Best for large runs with few colours',                  1500, false, 3),
  ('method', 'embroidery', 'تطريز',            'Embroidery',      'خيوط مطرّزة بملمس فاخر (للتصاميم الصغيرة)',       'Stitched thread with a premium feel (small designs)',   6000, false, 4),
  ('finish', 'matte',      'مطفي',             'Matte',           'ملمس ناعم بدون لمعان',                           'Soft finish, no shine',                                 0, true, 1),
  ('finish', 'glossy',     'لامع',             'Glossy',          'سطح لامع بألوان زاهية',                           'Shiny surface, vivid colours',                          1000, false, 2),
  ('finish', 'puff',       'بارز 3D',          '3D puff',         'طباعة بارزة بملمس مرتفع',                         'Raised, textured print',                                2500, false, 3),
  ('finish', 'glitter',    'لمعة جليتر',       'Glitter',         'جزيئات لامعة تلمع تحت الضوء',                     'Sparkling particles that catch the light',              2500, false, 4),
  ('finish', 'reflective', 'عاكس للضوء',       'Reflective',      'يلمع عند تسليط الضوء عليه ليلاً',                 'Lights up under headlights at night',                   3000, false, 5),
  ('fabric', 'standard',   'قطن قياسي ٢٤٠غ',   'Standard 240 GSM','قطن مريح للاستخدام اليومي',                       'Comfortable everyday cotton',                           0, true, 1),
  ('fabric', 'heavy',      'قطن ثقيل ٣٢٠غ',    'Heavyweight 320 GSM','قماش أثقل بقَصّة فاخرة',                      'Heavier cloth with a premium drape',                    5000, false, 2),
  ('fabric', 'organic',    'قطن مسرّح فاخر',   'Combed premium',  'ألياف مسرّحة أنعم وأكثر متانة',                   'Softer, longer-lasting combed fibres',                  3500, false, 3),
  ('package', 'standard',  'تغليف عادي',       'Standard bag',    'كيس شفاف',                                        'Clear polybag',                                         0, true, 1),
  ('package', 'gift',      'علبة هدية',        'Gift box',        'علبة أنيقة جاهزة للإهداء',                       'Neat box, ready to gift',                               2500, false, 2),
  ('addon', 'custom_label','علامة رقبة مخصصة', 'Custom neck label','علامة بشعارك داخل ياقة القطعة',                 'Your own label inside the collar',                      1500, false, 1),
  ('addon', 'hang_tag',    'بطاقة تعليق',      'Hang tag',        'بطاقة معلّقة بشعار TPAC',                         'TPAC hang tag',                                         500, false, 2),
  ('addon', 'gift_note',   'بطاقة إهداء',      'Gift note',       'بطاقة مكتوبة بخطك داخل العبوة',                   'A handwritten-style card in the package',               500, false, 3),
  ('addon', 'single_pack', 'تغليف فردي',       'Individually packed','كل قطعة بكيس منفصل',                          'Every piece packed separately',                         300, false, 4),
  ('addon', 'rush',        'تجهيز سريع',       'Rush production', 'أولوية في الطباعة والتسليم',                      'Priority printing and dispatch',                        5000, false, 5)
) v(group_code, code, name_ar, name_en, description_ar, description_en, price, is_default, sort_order)
where not exists (select 1 from public.designer_options);

insert into public.designer_tiers (min_qty, discount_percent)
select * from (values (6, 5), (12, 10), (24, 15), (50, 20)) v(min_qty, discount_percent)
where not exists (select 1 from public.designer_tiers);

insert into public.website_settings (key, value) values
  ('designer', '{"lead_days_min":3,"lead_days_max":5,"rush_days":2,"notice_ar":"كل قطعة تُطبع حسب الطلب ولا يمكن إرجاعها بعد الطباعة. راجع التصميم جيداً قبل التأكيد.","notice_en":"Every piece is printed to order and cannot be returned after printing. Please review your design carefully before confirming.","min_dpi":150}'::jsonb)
on conflict (key) do nothing;

-- 5) Garments: long sleeve joins the designer (T-shirt, oversized, hoodie, sweatshirt, long sleeve)
insert into public.custom_garment_types (code, name_ar, name_en, base_price, color_ids, sizes, print_locations, sort_order, is_active)
select 'longsleeve', 'تيشيرت كم طويل', 'Long-sleeve tee', 28000,
       array(select id from public.colors where code in ('black', 'white')), '{S,M,L,XL,XXL}',
       '{front,back,left_chest,sleeve,sleeve_left}', 5, false
where not exists (select 1 from public.custom_garment_types where code = 'longsleeve');

-- 6) quote_cart: quantity discount on custom pieces (the only place prices are computed)
create or replace function public.quote_cart(payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_qty int;
  v_line jsonb;
  r record;
  d record;
  z record;
  v_discount int := 0;
  v_discount_info jsonb := null;
  v_delivery_fee int := 0;
  v_delivery_info jsonb := null;
  v_method text := coalesce(payload ->> 'delivery_method', 'standard');
  v_code text := upper(nullif(trim(payload ->> 'discount_code'), ''));
  v_user uuid := nullif(payload ->> 'user_id', '')::uuid;
  v_phone text := public.normalize_iraqi_phone(payload ->> 'phone');
  v_free_shipping boolean := false;
  v_uses int;
  v_min_order int := coalesce((select (value ->> 'min_order_total')::int from public.website_settings where key = 'checkout'), 0);
  v_has_custom boolean := false;
  v_seen jsonb := '{}'::jsonb;
  v_key text;
  v_custom_qty int := 0;
  v_tier_pct int := 0;
  v_unit int;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty_cart');
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) > 50 then
    raise exception 'too_many_items' using errcode = '22023';
  end if;

  -- Quantity discount for made-to-order pieces: based on the TOTAL number of custom pieces in the cart.
  select coalesce(sum((e ->> 'quantity')::int), 0) into v_custom_qty
    from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) e
   where e ->> 'custom_design_id' is not null and coalesce((e ->> 'quantity')::int, 0) between 1 and 99;
  select coalesce(max(discount_percent), 0) into v_tier_pct
    from public.designer_tiers where is_active and min_qty <= v_custom_qty;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    v_key := coalesce(v_item ->> 'variant_id', v_item ->> 'custom_design_id', '');
    if v_seen ? v_key then
      raise exception 'duplicate_cart_line' using errcode = '22023';
    end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);

    if v_item ? 'variant_id' and v_item ->> 'variant_id' is not null then
      select v.id as variant_id, v.sku, v.size_code, p.id as product_id, p.slug, p.name_ar, p.name_en,
             coalesce(v.price_override, p.base_price) as unit_price,
             c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex,
             coalesce(i.quantity, 0) as stock,
             (v.is_active and p.is_published) as sellable,
             (select pi.url from public.product_images pi
               where pi.product_id = p.id and (pi.color_id = v.color_id or pi.color_id is null)
               order by (pi.color_id = v.color_id) desc nulls last, pi.sort_order limit 1) as image_url
        into r
        from public.product_variants v
        join public.products p on p.id = v.product_id
        join public.colors c on c.id = v.color_id
        left join public.inventory i on i.variant_id = v.id
       where v.id = (v_item ->> 'variant_id')::uuid;

      if not found or not r.sellable then
        v_line := jsonb_build_object('variant_id', v_item ->> 'variant_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'variant_id', v_item ->> 'variant_id');
      else
        v_line := jsonb_build_object(
          'variant_id', r.variant_id, 'product_id', r.product_id, 'slug', r.slug, 'sku', r.sku,
          'name_ar', r.name_ar, 'name_en', r.name_en, 'size_code', r.size_code,
          'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en, 'color_hex', r.color_hex,
          'image_url', r.image_url, 'unit_price', r.unit_price, 'quantity', v_qty,
          'available', r.stock, 'line_total', r.unit_price * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'variant_id', r.variant_id);
        elsif v_qty > r.stock then
          v_line := v_line || jsonb_build_object('error', 'insufficient_stock');
          v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'variant_id', r.variant_id, 'available', r.stock);
        else
          v_subtotal := v_subtotal + r.unit_price * v_qty;
        end if;
      end if;

    elsif v_item ? 'custom_design_id' and v_item ->> 'custom_design_id' is not null then
      select cd.id, cd.unit_price, cd.size_code, cd.preview_front_path, cd.print_locations,
             g.name_ar, g.name_en, c.name_ar as color_name_ar, c.name_en as color_name_en, c.hex as color_hex
        into r
        from public.custom_designs cd
        join public.custom_garment_types g on g.code = cd.garment_type
        join public.colors c on c.id = cd.color_id
       where cd.id = (v_item ->> 'custom_design_id')::uuid
         and (cd.user_id is null or cd.user_id = v_user);
      if not found then
        v_line := jsonb_build_object('custom_design_id', v_item ->> 'custom_design_id', 'quantity', v_qty, 'error', 'unavailable', 'line_total', 0);
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'custom_design_id', v_item ->> 'custom_design_id');
      else
        v_has_custom := true;
        v_unit := greatest(r.unit_price - (round(r.unit_price * v_tier_pct / 100.0 / 250.0) * 250)::int, 0);
        v_line := jsonb_build_object(
          'custom_design_id', r.id, 'name_ar', r.name_ar || ' — تصميم خاص', 'name_en', 'Custom ' || r.name_en,
          'size_code', r.size_code, 'color_name_ar', r.color_name_ar, 'color_name_en', r.color_name_en,
          'color_hex', r.color_hex, 'preview_path', r.preview_front_path, 'print_locations', to_jsonb(r.print_locations),
          'unit_price', v_unit, 'list_price', r.unit_price, 'tier_percent', v_tier_pct,
          'quantity', v_qty, 'line_total', v_unit * greatest(v_qty, 0));
        if v_qty < 1 or v_qty > 99 then
          v_line := v_line || jsonb_build_object('error', 'invalid_quantity');
          v_errors := v_errors || jsonb_build_object('code', 'invalid_quantity', 'custom_design_id', r.id);
        else
          v_subtotal := v_subtotal + v_unit * v_qty;
        end if;
      end if;
    else
      raise exception 'invalid_cart_line' using errcode = '22023';
    end if;
    v_lines := v_lines || jsonb_build_array(v_line);
  end loop;

  -- Discount code ---------------------------------------------------
  if v_code is not null then
    select * into d from public.discount_codes where code = v_code;
    if not found or not d.is_active then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'invalid_code');
    elsif d.starts_at is not null and d.starts_at > now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'not_started');
    elsif d.ends_at is not null and d.ends_at < now() then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'expired');
    elsif d.max_uses is not null and d.used_count >= d.max_uses then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'usage_limit');
    elsif v_subtotal < d.min_order_total then
      v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'min_order', 'min_order_total', d.min_order_total);
    else
      v_uses := 0;
      if d.max_uses_per_customer is not null and (v_user is not null or v_phone is not null) then
        select count(*) into v_uses from public.discount_usage u
         where u.discount_code_id = d.id
           and ((v_user is not null and u.user_id = v_user) or (v_phone is not null and u.phone = v_phone));
      end if;
      if d.max_uses_per_customer is not null and v_uses >= d.max_uses_per_customer then
        v_discount_info := jsonb_build_object('code', v_code, 'valid', false, 'error', 'already_used');
      else
        if d.type = 'percent' then
          v_discount := floor(v_subtotal * d.value / 100.0)::int;
        elsif d.type = 'fixed' then
          v_discount := least(d.value, v_subtotal);
        else
          v_free_shipping := true;
        end if;
        if d.max_discount is not null then v_discount := least(v_discount, d.max_discount); end if;
        v_discount_info := jsonb_build_object('code', v_code, 'valid', true, 'type', d.type, 'value', d.value, 'id', d.id);
      end if;
    end if;
  end if;

  -- Delivery --------------------------------------------------------
  if payload ->> 'governorate' is not null then
    select * into z from public.delivery_zones where governorate = payload ->> 'governorate' and is_active;
    if not found then
      v_delivery_info := jsonb_build_object('available', false, 'error', 'unsupported_governorate');
      v_errors := v_errors || jsonb_build_object('code', 'unsupported_governorate');
    elsif v_method = 'pickup' then
      if z.pickup_available then
        v_delivery_fee := 0;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'pickup');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'pickup_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'pickup_unavailable');
      end if;
    elsif v_method = 'express' then
      if z.express_fee is not null then
        v_delivery_fee := z.express_fee;
        v_delivery_info := jsonb_build_object('available', true, 'method', 'express');
      else
        v_delivery_info := jsonb_build_object('available', false, 'error', 'express_unavailable');
        v_errors := v_errors || jsonb_build_object('code', 'express_unavailable');
      end if;
    elsif v_method = 'standard' then
      v_delivery_fee := z.standard_fee;
      if z.free_shipping_threshold is not null and (v_subtotal - v_discount) >= z.free_shipping_threshold then
        v_delivery_fee := 0;
      end if;
      v_delivery_info := jsonb_build_object('available', true, 'method', 'standard',
        'days_min', z.estimated_days_min, 'days_max', z.estimated_days_max);
    else
      raise exception 'invalid_delivery_method' using errcode = '22023';
    end if;
    if v_free_shipping and v_method <> 'pickup' then
      v_delivery_fee := 0;
    end if;
  end if;

  if v_subtotal > 0 and v_subtotal < v_min_order then
    v_errors := v_errors || jsonb_build_object('code', 'min_order_total', 'min_order_total', v_min_order);
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', greatest(v_subtotal - v_discount, 0) + v_delivery_fee,
    'discount', v_discount_info,
    'delivery', v_delivery_info,
    'has_custom_items', v_has_custom,
    'min_order_total', v_min_order,
    'errors', v_errors
  );
end $$;
