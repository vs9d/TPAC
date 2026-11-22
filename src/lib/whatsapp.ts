/** The shop's WhatsApp, used while the settings still hold the placeholder number. */
export const DEFAULT_WHATSAPP = "9647734194129";
const PLACEHOLDERS = new Set(["", "9647700000000"]);

/** Digits-only WhatsApp number for wa.me links. */
export const whatsappNumber = (n?: string | null) => {
  const digits = (n ?? "").replace(/\D/g, "");
  return PLACEHOLDERS.has(digits) ? DEFAULT_WHATSAPP : digits;
};
