import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase.from("newsletter_subscribers").select("email, locale, created_at").eq("is_active", true).order("created_at");
  const body = "﻿" + ["email,locale,subscribed_at", ...(data ?? []).map((r) => `"${r.email.replace(/"/g, '""')}",${r.locale},${r.created_at}`)].join("\r\n");
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tpac-newsletter.csv"', "Cache-Control": "no-store" } });
}
