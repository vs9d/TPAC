import { z } from "zod";

/**
 * Personalisation for couple sets (two hoodies sold as one product), set per product by the admin:
 * a second size, and fields such as a letter, a name or a date — once for the set or once per hoodie.
 * The customer's answers travel with the cart line as `{ key: value }`; the database
 * (public.couple_line_options) turns them into labelled options and stores them on the order line.
 */
export type OptionFieldType = "text" | "letter" | "date";

export interface OptionField {
  key: string;
  label_ar: string;
  label_en: string;
  type: OptionFieldType;
  /** one answer for each hoodie (keys `<key>_1`, `<key>_2`) instead of one for the set */
  per_piece: boolean;
  required: boolean;
}

export interface CoupleOptions {
  /** ask for the second hoodie's size (the size picked on the page is the first hoodie's) */
  second_size: boolean;
  fields: OptionField[];
}

/** An answer as stored on the order line and shown in the cart. */
export interface ResolvedOption {
  key: string;
  label_ar: string;
  label_en: string;
  value: string;
}

export const MAX_LEN: Record<OptionFieldType, number> = { letter: 3, date: 20, text: 30 };
export const TYPE_LABELS: Record<OptionFieldType, [string, string]> = {
  letter: ["حرف", "Letter"],
  date: ["تاريخ", "Date"],
  text: ["اسم / كلمة", "Name / word"],
};
export const PIECES: [string, string][] = [["الهودي الأول", "First hoodie"], ["الهودي الثاني", "Second hoodie"]];

const KEY = /^[a-z0-9_]{1,24}$/;

export const optionFieldSchema = z.object({
  key: z.string().regex(KEY),
  label_ar: z.string().trim().min(1).max(60),
  label_en: z.string().trim().max(60).default(""),
  type: z.enum(["text", "letter", "date"]),
  per_piece: z.boolean(),
  required: z.boolean(),
});

export const coupleOptionsSchema = z
  .object({ second_size: z.boolean(), fields: z.array(optionFieldSchema).max(8) })
  .refine((o) => new Set(o.fields.map((f) => f.key)).size === o.fields.length, "duplicate_key")
  .refine((o) => o.fields.every((f) => f.key !== "size"), "reserved_key");

/** The customer's answers on a cart line. */
export const optionValuesSchema = z
  .record(z.string().regex(/^[a-z0-9_]{1,30}$/), z.string().trim().max(60))
  .refine((o) => Object.keys(o).length <= 20, "too_many");

export type OptionValues = Record<string, string>;

/** Non-empty answers, keys sorted — the same answers always give the same cart line. */
export function cleanValues(v?: OptionValues | null): OptionValues {
  const out: OptionValues = {};
  for (const k of Object.keys(v ?? {}).sort()) {
    const s = String(v![k] ?? "").trim();
    if (s) out[k] = s.slice(0, 60);
  }
  return out;
}

export const valuesKey = (v?: OptionValues | null) => {
  const c = cleanValues(v);
  return Object.keys(c).length ? JSON.stringify(c) : "";
};

/** The inputs the product page shows, in order (sizes are handled separately). */
export function optionInputs(cfg: CoupleOptions) {
  return cfg.fields.flatMap((f) =>
    (f.per_piece ? [1, 2] : [0]).map((n) => ({
      name: n ? `${f.key}_${n}` : f.key,
      field: f,
      piece: n,
      label_ar: n ? `${f.label_ar} — ${PIECES[n - 1][0]}` : f.label_ar,
      label_en: n ? `${f.label_en || f.label_ar} — ${PIECES[n - 1][1]}` : f.label_en || f.label_ar,
      max: MAX_LEN[f.type],
    })),
  );
}

/** What is still missing before the set can go in the bag. */
export function missingInputs(cfg: CoupleOptions, values: OptionValues): string[] {
  const v = cleanValues(values);
  const missing = optionInputs(cfg).filter((i) => i.field.required && !v[i.name]).map((i) => i.name);
  if (cfg.second_size && !v.size_2) missing.unshift("size_2");
  return missing;
}

/** Same labels as the database gives, for showing a line before the server quote arrives. */
export function resolveLocally(cfg: CoupleOptions, size: string | undefined, values: OptionValues): ResolvedOption[] {
  const v = cleanValues(values);
  const out: ResolvedOption[] = [];
  if (cfg.second_size) {
    if (size) out.push({ key: "size_1", label_ar: `قياس ${PIECES[0][0]}`, label_en: `${PIECES[0][1]} size`, value: size });
    if (v.size_2) out.push({ key: "size_2", label_ar: `قياس ${PIECES[1][0]}`, label_en: `${PIECES[1][1]} size`, value: v.size_2 });
  }
  for (const i of optionInputs(cfg)) if (v[i.name]) out.push({ key: i.name, label_ar: i.label_ar, label_en: i.label_en, value: v[i.name].slice(0, i.max) });
  return out;
}

export const newFieldKey = () => `f${Math.random().toString(36).slice(2, 7)}`;

export function parseCoupleOptions(raw: unknown): CoupleOptions | null {
  const r = coupleOptionsSchema.safeParse(raw);
  return r.success ? r.data : null;
}
