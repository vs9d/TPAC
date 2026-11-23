import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { applyStatusUpdate } from "@/lib/notifications/whatsapp-queue";

export const dynamic = "force-dynamic";

/** Meta's webhook verification (Configuration → Webhook → Verify and save). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

type Payload = { entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[] } }[] }[] };

/** Delivery receipts: sent → delivered → read, or failed. Signed by Meta with the app secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new NextResponse("webhook not configured", { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("bad signature", { status: 401 });
  let body: Payload;
  try { body = JSON.parse(raw) as Payload; } catch { return new NextResponse("bad json", { status: 400 }); }
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) {
    if (!["sent", "delivered", "read", "failed"].includes(s.status)) continue;
    const err = s.errors?.[0];
    await applyStatusUpdate(s.id, s.status, err ? `${err.code ?? ""} ${err.title ?? err.message ?? ""}`.trim() : undefined);
  }
  return NextResponse.json({ ok: true });
}
