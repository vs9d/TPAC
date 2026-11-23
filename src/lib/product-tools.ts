/** Pure helpers used by the product admin tools (quick create, duplicate, CSV import/export). */

/** Latin slug from a product name: "Baghdad Hoodie!" -> "baghdad-hoodie". Arabic-only names return "". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** SKU prefix from a slug: "baghdad-oversized-tee" -> "TP-BOT". */
export function skuPrefix(slug: string): string {
  const initials = slug.split("-").filter(Boolean).map((w) => w[0]!).join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `TP-${(initials || "P").slice(0, 8)}`;
}

/** Next free slug: base, base-2, base-3 … */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "product";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now().toString(36)}`;
}

/** Slug for a duplicate: "tee" -> "tee-copy" -> "tee-copy-2" (never "tee-copy-copy"). */
export function copySlug(slug: string, taken: Set<string>): string {
  const base = slug.replace(/-copy(-\d+)?$/, "");
  return uniqueSlug(`${base}-copy`, taken);
}

/** Minimal RFC-4180 CSV parser: quotes, escaped quotes, newlines in cells, BOM, `,` / `;` / tab delimiters. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]!++;
  }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Escapes a CSV cell and neutralises spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const IMPORT_COLUMNS = ["name_ar", "name_en", "price", "category", "sizes", "colors", "stock", "published", "description_ar", "description_en", "slug", "compare_at_price"] as const;

export const IMPORT_TEMPLATE =
  IMPORT_COLUMNS.join(",") +
  "\n" +
  [
    ['"تيشيرت دجلة"', "Tigris Tee", "22000", "t-shirts", "S|M|L|XL", "black|white", "10", "yes", '"تيشيرت بطبعة دجلة"', '"Tigris print tee"', "", ""],
    ['"هودي بغداد"', "Baghdad Hoodie", "55000", "hoodies", "M|L|XL|XXL", "black", "5", "no", "", "", "baghdad-hoodie", "62000"],
  ]
    .map((r) => r.join(","))
    .join("\n") +
  "\n";

/** Ready descriptions the admin can drop into a product (hoodie, t-shirt …); matched to the product type by code. */
export const DESCRIPTION_PRESETS = [
  {
    key: "hoodie", types: ["hoodie", "sweatshirt"], label_ar: "وصف هودي", label_en: "Hoodie description",
    ar: `دفء، راحة، وجودة بتفاصيل تستحقها!

مصنوع من قماش قطني شتوي عالي الجودة، بخامة مريحة ودافئة تناسب أجواء الشتاء في العراق، مع قصة توفر لك الراحة بالاستخدام اليومي.

ويتميز بطباعة فائقة الدقة والوضوح، بألوان وتفاصيل تحافظ على جمالية التصميم.

المميزات:

• قماش قطني شتوي عالي الجودة.
• دافئ ومناسب لأجواء الشتاء العراقي.
• ملمس مريح للاستخدام اليومي.
• طباعة عالية الدقة بتفاصيل واضحة.
• جودة واهتمام بأدق التفاصيل.

TPAC — الحلو يلبس حلو.`,
    en: `Warmth, comfort and quality in every detail!

Made from high-quality winter cotton fabric — soft, warm and made for Iraqi winters, with a cut that keeps you comfortable every day.

Printed in ultra-high definition, with colours and details that keep the design looking its best.

Features:

• High-quality winter cotton fabric.
• Warm and made for the Iraqi winter.
• Comfortable feel for everyday wear.
• High-definition print with crisp details.
• Quality and care in every detail.

TPAC — الحلو يلبس حلو.`,
  },
  {
    key: "tshirt", types: ["tshirt", "oversized", "longsleeve"], label_ar: "وصف تيشيرت", label_en: "T-shirt description",
    ar: `تيشيرت TPAC 👕

بساطة، راحة، وجودة بكل تفصيلة!

تيشيرت مصنوع من قماش قطني عالي الجودة، ناعم ومريح على الجسم، مناسب للاستخدام اليومي ويوفر لك الراحة طوال اليوم.

يتميز بطباعة عالية الدقة والوضوح، مع تفاصيل وألوان تبرز جمال التصميم وتمنحه مظهراً مميزاً.

المميزات:

• قماش قطني عالي الجودة.
• ملمس ناعم ومريح.
• مناسب للاستخدام اليومي.
• طباعة فائقة الدقة والوضوح.
• جودة واهتمام بأدق التفاصيل.

TPAC — الحلو يلبس حلو.`,
    en: `TPAC T-shirt 👕

Simple, comfortable, quality in every detail!

Made from high-quality cotton — soft and comfortable on the skin, made for everyday wear and comfortable all day long.

Printed in high definition, with details and colours that bring out the design and give it a standout look.

Features:

• High-quality cotton fabric.
• Soft, comfortable feel.
• Made for everyday wear.
• Ultra-high-definition print.
• Quality and care in every detail.

TPAC — الحلو يلبس حلو.`,
  },
] as const;

export const TEXT_PRESETS = {
  material: [
    { key: "cotton240", label_ar: "قطن ثقيل ٢٤٠غ", label_en: "Heavy cotton 240 GSM", ar: "قطن ١٠٠٪ ثقيل بوزن ٢٤٠ غرام، ياقة مضلّعة سميكة، ومعالج ضد الانكماش.", en: "100% heavyweight cotton, 240 GSM, thick ribbed collar, pre-shrunk." },
    { key: "fleece320", label_ar: "فليس ٣٢٠غ (هودي)", label_en: "Fleece 320 GSM (hoodie)", ar: "قطن ٨٠٪ وبوليستر ٢٠٪ فليس من الداخل بوزن ٣٢٠ غرام.", en: "80% cotton / 20% polyester brushed fleece, 320 GSM." },
    { key: "cotton180", label_ar: "قطن خفيف ١٨٠غ", label_en: "Light cotton 180 GSM", ar: "قطن ١٠٠٪ ناعم بوزن ١٨٠ غرام، مناسب للصيف.", en: "100% soft cotton, 180 GSM, great for summer." },
  ],
  printing: [
    { key: "dtf", label_ar: "طباعة DTF", label_en: "DTF print", ar: "طباعة DTF عالية الدقة تتحمل الغسيل المتكرر دون تشقق.", en: "High-definition DTF print that withstands repeated washing without cracking." },
    { key: "screen", label_ar: "سلك سكرين", label_en: "Screen print", ar: "طباعة سلك سكرين بأحبار مائية ناعمة الملمس.", en: "Screen printed with soft-hand water-based inks." },
    { key: "embroidery", label_ar: "تطريز", label_en: "Embroidery", ar: "تطريز عالي الجودة بخيوط متينة.", en: "High-quality embroidery with durable thread." },
  ],
} as const;
