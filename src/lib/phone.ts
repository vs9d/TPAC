/** Mirrors public.normalize_iraqi_phone() in SQL. Returns 9647XXXXXXXXX or null. */
export function normalizeIraqiPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, "");
  if (d.startsWith("00964")) d = d.slice(2);
  if (d.startsWith("964")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^7[0-9]{9}$/.test(d) ? `964${d}` : null;
}

/** 9647701234567 -> 0770 123 4567 */
export function formatIraqiPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  const m = /^964(7\d{2})(\d{3})(\d{4})$/.exec(normalized);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : normalized;
}
