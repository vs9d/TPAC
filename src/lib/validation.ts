import { z } from "zod";
import { SHAPE_IDS } from "./design-assets";
import { normalizeIraqiPhone } from "./phone";
import { GOVERNORATES } from "./iraq";
import { ORDER_STATUSES } from "./order-status";

/**
 * Server-side validation schemas. Error messages are dictionary keys under
 * `validation.*` so the UI can localise them.
 */

const trimmed = (max: number) => z.string().trim().max(max, "max");
const requiredText = (max: number) => z.string().trim().min(1, "required").max(max, "max");

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeIraqiPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return n;
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || z.email().safeParse(v).success, "email");

const governorateCodes = GOVERNORATES.map((g) => g.code) as [string, ...string[]];
export const governorateSchema = z.enum(governorateCodes, { message: "required" });

export const uuid = z.uuid();

export const cartLineSchema = z.union([
  z.object({ variant_id: uuid, quantity: z.number().int().min(1).max(99) }),
  z.object({ custom_design_id: uuid, quantity: z.number().int().min(1).max(99) }),
]);
export const cartLinesSchema = z.array(cartLineSchema).max(50);

export const quoteSchema = z.object({
  items: cartLinesSchema,
  discount_code: z.string().trim().max(32).optional(),
  governorate: governorateSchema.optional(),
  delivery_method: z.enum(["standard", "express", "pickup"]).optional(),
  phone: z.string().max(30).optional(),
});

export const checkoutSchema = z.object({
  items: cartLinesSchema.min(1, "required"),
  customer_name: requiredText(120),
  phone: phoneSchema,
  email: optionalEmail,
  governorate: governorateSchema,
  city: requiredText(120),
  address_line: requiredText(500),
  delivery_notes: trimmed(500).optional(),
  delivery_method: z.enum(["standard", "express", "pickup"]),
  payment_method: z.enum(["cod", "online"]),
  discount_code: z.string().trim().max(32).optional(),
  save_address: z.boolean().optional(),
  locale: z.enum(["ar", "en"]),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const loginSchema = z.object({
  email: z.email("email"),
  password: z.string().min(1, "required").max(200),
});

export const registerSchema = z
  .object({
    full_name: requiredText(120),
    email: z.email("email"),
    phone: phoneSchema,
    password: z.string().min(8, "min").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export const profileSchema = z.object({
  full_name: requiredText(120),
  phone: phoneSchema,
  preferred_locale: z.enum(["ar", "en"]),
  marketing_opt_in: z.boolean(),
});

export const addressSchema = z.object({
  label: trimmed(60).optional(),
  full_name: requiredText(120),
  phone: phoneSchema,
  governorate: governorateSchema,
  city: requiredText(120),
  address_line: requiredText(500),
  notes: trimmed(500).optional(),
  is_default: z.boolean().optional(),
});

export const trackSchema = z.object({
  order_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^TP\d{4,10}$/, "required"),
  phone: phoneSchema,
});

export const newsletterSchema = z.object({ email: z.email("email"), locale: z.enum(["ar", "en"]) });

export const contactSchema = z.object({
  name: requiredText(120),
  phone: z.string().trim().max(30).optional(),
  email: optionalEmail,
  message: requiredText(4000),
});

export const reviewSchema = z.object({
  product_id: uuid,
  rating: z.number().int().min(1).max(5),
  body: trimmed(2000).optional(),
});

export const BULK_PRODUCT_TYPES = ["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve", "polo", "other"] as const;
export const BULK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"] as const;

export const bulkRequestSchema = z.object({
  organization_name: requiredText(200),
  contact_name: requiredText(120),
  phone: phoneSchema,
  email: optionalEmail,
  product_type: z.enum(BULK_PRODUCT_TYPES),
  estimated_quantity: z.coerce.number().int().min(1, "quantity").max(100000, "quantity"),
  size_breakdown: z.partialRecord(z.enum(BULK_SIZES), z.coerce.number().int().min(0).max(100000)).default({}),
  printing_requirements: trimmed(4000).optional(),
  notes: trimmed(4000).optional(),
  artwork_ids: z.array(uuid).max(5).default([]),
});

/* -------------------------- designer --------------------------- */

const designObject = z.object({
  type: z.enum(["image", "text", "shape"]),
  location: z.enum(["front", "back", "left_chest", "sleeve", "sleeve_left"]),
  left: z.number().finite(),
  top: z.number().finite(),
  // tiny artwork may be scaled up a lot; what matters is the rendered size (checked below)
  scaleX: z.number().finite().max(5000).refine((n) => n !== 0, "scale"),
  scaleY: z.number().finite().max(5000).refine((n) => n !== 0, "scale"),
  angle: z.number().finite().min(-720).max(720),
  width: z.number().finite().positive().max(20000),
  height: z.number().finite().positive().max(20000),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  artwork_id: uuid.optional(),
  filters: z.object({ grayscale: z.boolean().optional(), invert: z.boolean().optional() }).optional(),
  shape_id: z.enum(SHAPE_IDS).optional(),
  text: z.string().max(200).optional(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  strokeWidth: z.number().min(0).max(40).optional(),
  fontFamily: z.string().max(80).optional(),
  fontLabel: z.string().max(40).optional(),
  fontSize: z.number().positive().max(600).optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  underline: z.boolean().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  charSpacing: z.number().min(-200).max(2000).optional(),
  lineHeight: z.number().min(0.5).max(4).optional(),
}).refine((o) => Math.abs(o.width * o.scaleX) <= 1400 && Math.abs(o.height * o.scaleY) <= 1600, { message: "max", path: ["scaleX"] })
  .refine((o) => (o.type === "shape" ? !!o.shape_id : true), { message: "required", path: ["shape_id"] });

const sizeQuantities = z
  .record(z.string().regex(/^[A-Z0-9]{1,6}$/), z.number().int().min(0).max(99))
  .transform((r) => Object.fromEntries(Object.entries(r).filter(([, n]) => n > 0)))
  .refine((r) => Object.keys(r).length >= 1 && Object.values(r).reduce((a, b) => a + b, 0) <= 400, { message: "quantity" });

export const designSchema = z.object({
  garment_type: z.enum(["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve"]),
  color_id: uuid,
  /** quantity per size, e.g. { M: 2, L: 3 } — one saved design (and one cart line) per size */
  sizes: sizeQuantities,
  name: trimmed(80).optional(),
  options: z.object({
    method: z.string().regex(/^[a-z0-9_]{2,32}$/).optional(),
    finish: z.string().regex(/^[a-z0-9_]{2,32}$/).optional(),
    fabric: z.string().regex(/^[a-z0-9_]{2,32}$/).optional(),
    package: z.string().regex(/^[a-z0-9_]{2,32}$/).optional(),
    addons: z.array(z.string().regex(/^[a-z0-9_]{2,32}$/)).max(12).optional(),
  }).default({}),
  objects: z.array(designObject).min(1, "required").max(40),
  notes: trimmed(1000).optional(),
  preview_front: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000),
  preview_back: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000),
  /** previews of sleeves that have their own close-up photo */
  preview_sides: z.object({
    right: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000).optional(),
    left: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000).optional(),
  }).optional(),
});
export type DesignInput = z.infer<typeof designSchema>;

/* ---------------------------- admin ---------------------------- */

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug").max(120);
const optText = (max = 5000) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const money = z.coerce.number().int().min(0).max(100_000_000);

export const productSchema = z.object({
  slug,
  name_ar: requiredText(200),
  name_en: requiredText(200),
  description_ar: optText(),
  description_en: optText(),
  material_ar: optText(1000),
  material_en: optText(1000),
  printing_ar: optText(1000),
  printing_en: optText(1000),
  category_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
  base_price: money,
  compare_at_price: z
    .union([money, z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === 0 ? null : v)),
  is_published: z.boolean(),
  is_featured: z.boolean(),
  is_new_arrival: z.boolean(),
  is_limited: z.boolean(),
  is_customizable: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  seo_title_ar: optText(120),
  seo_title_en: optText(120),
  seo_description_ar: optText(300),
  seo_description_en: optText(300),
  collection_ids: z.array(uuid).max(50),
});

export const variantSchema = z.object({
  id: uuid.optional(),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,64}$/, "sku"),
  size_code: z.string().regex(/^[A-Z0-9]{1,6}$/),
  color_id: uuid,
  price_override: z
    .union([money, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  is_active: z.boolean(),
  low_stock_threshold: z.coerce.number().int().min(0).max(10000).default(5),
});

export const categorySchema = z.object({
  slug,
  name_ar: requiredText(120),
  name_en: requiredText(120),
  description_ar: optText(1000),
  description_en: optText(1000),
  image_url: optText(1000),
  parent_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
});

export const collectionSchema = z.object({
  slug,
  name_ar: requiredText(120),
  name_en: requiredText(120),
  description_ar: optText(2000),
  description_en: optText(2000),
  image_url: optText(1000),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  featured_from: optText(40),
  featured_until: optText(40),
  sort_order: z.coerce.number().int().min(0).max(10000),
});

export const colorSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "slug"),
  name_ar: requiredText(60),
  name_en: requiredText(60),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sort_order: z.coerce.number().int().min(0).max(1000),
});

export const sizeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/),
  label: requiredText(20),
  sort_order: z.coerce.number().int().min(0).max(1000),
});

export const discountSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "code"),
  description: optText(300),
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: money,
  min_order_total: money,
  max_discount: z.union([money, z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  max_uses: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  max_uses_per_customer: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  starts_at: optText(40),
  ends_at: optText(40),
  is_active: z.boolean(),
}).refine((v) => v.type !== "percent" || (v.value >= 1 && v.value <= 100), { path: ["value"], message: "percent" });

export const deliveryZoneSchema = z.object({
  id: uuid,
  standard_fee: money,
  express_fee: z.union([money, z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  pickup_available: z.boolean(),
  estimated_days_min: z.coerce.number().int().min(0).max(60),
  estimated_days_max: z.coerce.number().int().min(0).max(60),
  free_shipping_threshold: z.union([money, z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  is_active: z.boolean(),
});

export const bannerSchema = z.object({
  placement: z.enum(["announcement", "hero", "promo"]),
  title_ar: optText(300),
  title_en: optText(300),
  subtitle_ar: optText(500),
  subtitle_en: optText(500),
  cta_label_ar: optText(60),
  cta_label_en: optText(60),
  link: optText(500).refine((v) => !v || v.startsWith("/") || v.startsWith("https://"), "link"),
  image_url: optText(1000),
  video_url: optText(1000).refine((v) => !v || /^(https?:\/\/|\/)/.test(v), "link"),
  starts_at: optText(40),
  ends_at: optText(40),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(1000),
});

export const homepageSectionSchema = z.object({
  key: z.string().regex(/^[a-z_]+$/),
  title_ar: optText(300),
  title_en: optText(300),
  subtitle_ar: optText(1000),
  subtitle_en: optText(1000),
  body_ar: optText(4000),
  body_en: optText(4000),
  image_url: optText(1000),
  cta_label_ar: optText(60),
  cta_label_en: optText(60),
  cta_href: optText(500),
  data: z.string().max(10000).transform((v, ctx) => {
    try {
      const parsed = v.trim() ? JSON.parse(v) : {};
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: "custom", message: "json" });
      return z.NEVER;
    }
  }),
  sort_order: z.coerce.number().int().min(0).max(1000),
  is_visible: z.boolean(),
});

export const orderStatusUpdateSchema = z.object({
  order_id: uuid,
  status: z.enum(ORDER_STATUSES),
  note: trimmed(1000).optional(),
});

export const inventoryAdjustSchema = z.object({
  variant_id: uuid,
  change: z.coerce.number().int().min(-100000).max(100000).refine((v) => v !== 0, "required"),
  reason: z.enum(["adjustment", "return", "restock", "damage", "initial"]),
  note: trimmed(500).optional(),
});

export const quotationItemSchema = z.object({
  description: requiredText(300),
  size: trimmed(20).optional(),
  quantity: z.coerce.number().int().min(1).max(100000),
  unit_price: money,
});

export const quotationSchema = z.object({
  id: uuid.optional(),
  bulk_request_id: uuid,
  items: z.array(quotationItemSchema).min(1).max(50),
  discount: money,
  delivery_fee: money,
  valid_until: optText(20),
  notes: optText(4000),
  status: z.enum(["draft", "sent", "approved", "rejected", "expired"]),
});

export const bulkPricingRuleSchema = z.object({
  id: uuid.optional(),
  product_type: z.enum(BULK_PRODUCT_TYPES),
  min_quantity: z.coerce.number().int().min(1),
  max_quantity: z.union([z.coerce.number().int().min(1), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  unit_price: money,
  is_active: z.boolean(),
});

/** Flattens zod issues into { field: messageKey } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
