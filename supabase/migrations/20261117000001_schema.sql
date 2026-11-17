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
