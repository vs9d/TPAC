import "server-only";

/** Email provider: Resend (https://resend.com). Configure RESEND_API_KEY + EMAIL_FROM. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  if (!emailConfigured()) throw new Error("email_provider_not_configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend_${res.status}: ${(await res.text()).slice(0, 300)}`);
}
