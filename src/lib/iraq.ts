/** Iraqi governorates. Codes match public.delivery_zones.governorate. */
export const GOVERNORATES = [
  { code: "baghdad", ar: "بغداد", en: "Baghdad" },
  { code: "basra", ar: "البصرة", en: "Basra" },
  { code: "nineveh", ar: "نينوى", en: "Nineveh" },
  { code: "erbil", ar: "أربيل", en: "Erbil" },
  { code: "sulaymaniyah", ar: "السليمانية", en: "Sulaymaniyah" },
  { code: "duhok", ar: "دهوك", en: "Duhok" },
  { code: "halabja", ar: "حلبجة", en: "Halabja" },
  { code: "kirkuk", ar: "كركوك", en: "Kirkuk" },
  { code: "diyala", ar: "ديالى", en: "Diyala" },
  { code: "anbar", ar: "الأنبار", en: "Anbar" },
  { code: "babil", ar: "بابل", en: "Babil" },
  { code: "karbala", ar: "كربلاء", en: "Karbala" },
  { code: "najaf", ar: "النجف", en: "Najaf" },
  { code: "wasit", ar: "واسط", en: "Wasit" },
  { code: "salahuddin", ar: "صلاح الدين", en: "Salah al-Din" },
  { code: "qadisiyah", ar: "الديوانية", en: "Al-Qadisiyah" },
  { code: "maysan", ar: "ميسان", en: "Maysan" },
  { code: "dhi_qar", ar: "ذي قار", en: "Dhi Qar" },
  { code: "muthanna", ar: "المثنى", en: "Muthanna" },
] as const;

export type GovernorateCode = (typeof GOVERNORATES)[number]["code"];

export function governorateName(code: string, locale: "ar" | "en"): string {
  const g = GOVERNORATES.find((x) => x.code === code);
  return g ? g[locale] : code;
}
