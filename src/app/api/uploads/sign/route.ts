import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { UPLOAD_LIMITS, EXT } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/env";

const schema = z.object({
  purpose: z.enum(["design", "bulk", "review"]),
  type: z.enum(UPLOAD_LIMITS.artworkTypes),
  size: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes),
});

/**
 * Step 1 of an artwork upload: returns a one-time signed URL so the browser
 * uploads straight to the private bucket (large files never pass through the
 * app server). The file is verified in /api/uploads/complete before use.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  if (parsed.data.purpose === "design" && parsed.data.type === "application/pdf") return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  if (parsed.data.purpose === "review" && !["image/png", "image/jpeg", "image/webp"].includes(parsed.data.type)) return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  if (!(await rateLimit("upload"))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const month = new Date().toISOString().slice(0, 7);
  const path = `uploads/${parsed.data.purpose}/${month}/${crypto.randomUUID()}.${EXT[parsed.data.type]}`;
  const { data, error } = await createAdminClient().storage.from("design-uploads").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
