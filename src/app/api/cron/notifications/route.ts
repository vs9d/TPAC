import { NextResponse, type NextRequest } from "next/server";
import { processWhatsAppQueue } from "@/lib/notifications/whatsapp-queue";

export const dynamic = "force-dynamic";

/**
 * Retries WhatsApp messages that failed for a temporary reason. Call it every few minutes from any cron service
 * (Vercel Cron, cron-job.org …) with the header  Authorization: Bearer <CRON_SECRET>.
 * Retries also run whenever a new message is sent and when the dashboard's WhatsApp page opens.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("forbidden", { status: 403 });
  return NextResponse.json(await processWhatsAppQueue(50));
}
