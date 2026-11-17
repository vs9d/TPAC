import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation / password recovery landing: exchanges the one-time code for a session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? `/${locale}/account`;
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : `/${locale}/account`;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safe, req.url));
  }
  return NextResponse.redirect(new URL(`/${locale}/account/login?error=link`, req.url));
}
