import "server-only";

/**
 * WhatsApp Business Cloud API (Meta Graph API).
 * Business-initiated messages must use a pre-approved template. Configure:
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 *   WHATSAPP_TEMPLATE_ORDER_UPDATE (template name), WHATSAPP_TEMPLATE_LANGUAGE (e.g. "ar")
 * The template's body parameters are filled positionally from `params`.
 */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE);
}

export async function sendWhatsAppTemplate(input: { to: string; params: string[] }): Promise<void> {
  if (!whatsappConfigured()) throw new Error("whatsapp_provider_not_configured");
  const to = input.to.replace(/[^0-9]/g, "");
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar" },
        components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text: text.slice(0, 1000) })) }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`whatsapp_${res.status}: ${(await res.text()).slice(0, 300)}`);
}
