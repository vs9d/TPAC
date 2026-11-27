import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Serves one uploaded image of a shared couple design (?share=<token>) or of an approved
 * community design (?community=<id>) — same-origin, so the studio can draw and export it.
 * The image must belong to that design: a token or id alone never opens other files.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const share = req.nextUrl.searchParams.get("share");
  const community = req.nextUrl.searchParams.get("community");
  const db = createAdminClient();
  let allowed = false;
  if (share && /^[A-Za-z0-9_-]{20,64}$/.test(share)) {
    const { data } = await db.from("design_drafts").select("data, expires_at").eq("token", share).maybeSingle();
    allowed = !!data && new Date(data.expires_at as string) > new Date() && JSON.stringify(data.data).includes(`"tpacArtworkId":"${id}"`);
  } else if (community && /^[0-9a-f-]{36}$/.test(community)) {
    const { data } = await db.from("community_designs").select("artwork_ids, status").eq("id", community).maybeSingle();
    allowed = !!data && data.status === "approved" && (data.artwork_ids as string[]).includes(id);
  }
  if (!allowed) return new NextResponse(null, { status: 404 });
  const { data: art } = await db.from("uploaded_artwork").select("storage_path, mime_type").eq("id", id).maybeSingle();
  if (!art) return new NextResponse(null, { status: 404 });
  const { data: blob } = await db.storage.from("design-uploads").download(art.storage_path as string);
  if (!blob) return new NextResponse(null, { status: 404 });
  return new NextResponse(blob, {
    headers: {
      "content-type": art.mime_type as string,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      // an uploaded SVG is only ever an image here
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
