import "server-only";

/**
 * WhatsApp Business Platform — Cloud API (Meta Graph API). Official API only.
 * Business-initiated messages use templates approved in WhatsApp Manager.
 * Server-only environment variables:
 *   WHATSAPP_ACCESS_TOKEN        permanent system-user token
 *   WHATSAPP_PHONE_NUMBER_ID     the sending number's id
 *   WHATSAPP_TEMPLATE_ORDER_UPDATE  general order-update template (optional when every status has its own)
 *   WHATSAPP_TEMPLATE_LANGUAGE   e.g. "ar" (default)
 *   WHATSAPP_APP_SECRET          verifies the delivery-status webhook signature
 *   WHATSAPP_VERIFY_TOKEN        any secret string, entered again in Meta's webhook settings
 */
// WHATSAPP_API_BASE only points tests at a local mock of the Graph API
const GRAPH = process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export class WhatsAppError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly code?: number) {
    super(message);
  }
}

/** Sends a template message; returns Meta's message id. Throws WhatsAppError (retryable for 429 / 5xx / network). */
export async function sendWhatsAppTemplate(input: { to: string; params: string[]; template?: string; language?: string }): Promise<string> {
  if (!whatsappConfigured()) throw new WhatsAppError("whatsapp_provider_not_configured", false);
  const template = input.template || process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE;
  if (!template) throw new WhatsAppError("no_template: set a template name for this status or WHATSAPP_TEMPLATE_ORDER_UPDATE", false);
  const to = input.to.replace(/[^0-9]/g, "");
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: input.language || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar" },
          components: input.params.length ? [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text: text.slice(0, 1024) })) }] : [],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new WhatsAppError(`network: ${e instanceof Error ? e.message : "error"}`.slice(0, 300), true);
  }
  const body = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null;
  if (!res.ok || !body?.messages?.[0]?.id) {
    const code = body?.error?.code;
    // 429 / 5xx and Meta's throttling codes are temporary; template / number / permission errors are not
    const retryable = res.status === 429 || res.status >= 500 || code === 4 || code === 80007 || code === 130429 || code === 131000 || code === 131016;
    throw new WhatsAppError(`whatsapp_${res.status}${code ? `/${code}` : ""}: ${(body?.error?.message ?? "").slice(0, 300)}`, retryable, code);
  }
  return body.messages[0].id;
}
