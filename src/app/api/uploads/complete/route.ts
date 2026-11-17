import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { UPLOAD_LIMITS, sniffMime, isSafeSvg } from "@/lib/storage";

const schema = z.object({
  path: z.string().regex(/^uploads\/(design|bulk)\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(png|jpg|webp|svg|pdf)$/),
  original_name: z.string().max(200).optional(),
});

async function dimensions(buf: Buffer, mime: string): Promise<{ width?: number; height?: number }> {
  if (mime === "application/pdf" || mime === "image/svg+xml") return {};
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(buf).metadata();
    return { width: m.width, height: m.height };
  } catch {
    return {};
  }
}

/** Step 2: verify the uploaded object's real type/size, then register it. Invalid files are deleted. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  if (!(await rateLimit("upload", "complete"))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const db = createAdminClient();
  const bucket = db.storage.from("design-uploads");
  const { data: blob, error } = await bucket.download(parsed.data.path);
  if (error || !blob) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const buf = Buffer.from(await blob.arrayBuffer());
  const mime = sniffMime(buf);
  const purpose = parsed.data.path.split("/")[1];
  const reject = async () => {
    await bucket.remove([parsed.data.path]);
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  };
  if (!mime || !(UPLOAD_LIMITS.artworkTypes as readonly string[]).includes(mime) || buf.length > UPLOAD_LIMITS.maxBytes) return reject();
  if (purpose === "design" && mime === "application/pdf") return reject();
  if (mime === "image/svg+xml" && !isSafeSvg(buf.toString("utf8"))) return reject();
  const session = await getSession();
  const dim = await dimensions(buf, mime);
  const { data, error: insErr } = await db
    .from("uploaded_artwork")
    .insert({
      storage_path: parsed.data.path,
      mime_type: mime,
      size_bytes: buf.length,
      width: dim.width ?? null,
      height: dim.height ?? null,
      original_name: parsed.data.original_name?.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) ?? null,
      uploaded_by: session?.userId ?? null,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.code === "23505" ? "duplicate" : "failed" }, { status: 409 });
  return NextResponse.json({ id: data.id, mime, width: dim.width ?? null, height: dim.height ?? null });
}
