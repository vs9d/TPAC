import type { OrderStatus } from "./order-status";

export type Role = "customer" | "staff" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  preferred_locale: "ar" | "en";
  marketing_opt_in: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Collection {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  featured_from: string | null;
  featured_until: string | null;
  sort_order: number;
}

export interface Color {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  hex: string;
  sort_order: number;
}

export interface Size {
  code: string;
  label: string;
  sort_order: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  storage_path: string | null;
  alt_ar: string | null;
  alt_en: string | null;
  color_id: string | null;
  sort_order: number;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  size_code: string;
  color_id: string;
  price_override: number | null;
  is_active: boolean;
  color?: Color;
  inventory?: { quantity: number; low_stock_threshold: number } | null;
}

export interface Product {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  material_ar: string | null;
  material_en: string | null;
  printing_ar: string | null;
  printing_en: string | null;
  category_id: string | null;
  base_price: number;
  compare_at_price: number | null;
  is_published: boolean;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_limited: boolean;
  is_customizable: boolean;
  sales_count: number;
  tags: string[];
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductDetail extends Product {
  category: Category | null;
  product_images: ProductImage[];
  product_variants: Variant[];
}

/** Shape returned by public.catalog_search() */
export interface ProductCard {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  price: number;
  compare_at_price: number | null;
  is_new_arrival: boolean;
  is_limited: boolean;
  is_customizable: boolean;
  images: { url: string; alt_ar: string | null; alt_en: string | null }[];
  colors: string[];
  in_stock: boolean;
}

export interface DeliveryZone {
  id: string;
  governorate: string;
  name_ar: string;
  name_en: string;
  standard_fee: number;
  express_fee: number | null;
  pickup_available: boolean;
  estimated_days_min: number;
  estimated_days_max: number;
  free_shipping_threshold: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface QuoteLine {
  variant_id?: string;
  custom_design_id?: string;
  product_id?: string;
  slug?: string;
  sku?: string;
  name_ar: string;
  name_en: string;
  size_code?: string;
  color_name_ar?: string;
  color_name_en?: string;
  color_hex?: string;
  image_url?: string | null;
  preview_path?: string | null;
  print_locations?: string[];
  unit_price: number;
  quantity: number;
  available?: number;
  line_total: number;
  error?: "unavailable" | "insufficient_stock" | "invalid_quantity";
}

export interface CartQuote {
  lines: QuoteLine[];
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  discount: { code: string; valid: boolean; error?: string; type?: string; value?: number; min_order_total?: number } | null;
  delivery: { available: boolean; method?: string; error?: string; days_min?: number; days_max?: number } | null;
  has_custom_items: boolean;
  min_order_total: number;
  errors: { code: string; [k: string]: unknown }[];
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  governorate: string;
  city: string;
  address_line: string;
  delivery_notes: string | null;
  delivery_method: "standard" | "express" | "pickup";
  payment_method: "cod" | "online";
  payment_status: "unpaid" | "pending" | "paid" | "refunded" | "failed";
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  discount_code: string | null;
  locale: "ar" | "en";
  source: "web" | "bulk" | "admin";
  has_custom_items: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  custom_design_id: string | null;
  name_ar: string;
  name_en: string;
  sku: string | null;
  size_code: string | null;
  color_name_ar: string | null;
  color_name_en: string | null;
  color_hex: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface StatusHistory {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  full_name: string;
  phone: string;
  governorate: string;
  city: string;
  address_line: string;
  notes: string | null;
  is_default: boolean;
}

export interface HomepageSection {
  key: string;
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  image_url: string | null;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  cta_href: string | null;
  data: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
}

export interface PromoBanner {
  id: string;
  placement: "announcement" | "hero" | "promo";
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  link: string | null;
  image_url: string | null;
  video_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface GarmentTypeRow {
  code: "tshirt" | "oversized" | "hoodie" | "sweatshirt";
  name_ar: string;
  name_en: string;
  base_price: number;
  color_ids: string[];
  sizes: string[];
  print_locations: string[];
  sort_order: number;
  is_active: boolean;
}

export interface PrintLocationRow {
  code: "front" | "back" | "left_chest" | "sleeve" | "sleeve_left";
  name_ar: string;
  name_en: string;
  price: number;
  sort_order: number;
  is_active: boolean;
}

export interface SiteSettings {
  brand: { name: string; tagline_ar: string; tagline_en: string; logo_url: string };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address_ar: string;
    address_en: string;
    hours_ar: string;
    hours_en: string;
  };
  social: { instagram: string; tiktok: string; facebook: string; snapchat: string };
  checkout: { min_order_total: number; allow_guest_checkout: boolean; online_payment_enabled: boolean };
  currency: { code: string; symbol_ar: string; symbol_en: string };
  languages: { default: "ar" | "en"; enabled: ("ar" | "en")[] };
  notifications: {
    admin_email: string;
    admin_whatsapp: string;
    customer_email: boolean;
    customer_whatsapp: boolean;
    admin_new_order: boolean;
    admin_low_stock: boolean;
    admin_bulk_request: boolean;
  };
}
