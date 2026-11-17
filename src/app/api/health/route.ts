import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Setup diagnostics: reports WHICH configuration is present/valid, never the values.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: !url ? "missing" : /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url.trim()) ? "ok" : url.trim() !== url ? "has spaces" : "wrong format (expected https://xxxx.supabase.co)",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !anon ? "missing" : anon.trim() !== anon ? "has spaces" : anon.length < 40 ? "too short" : "ok",
    SUPABASE_SERVICE_ROLE_KEY: !service ? "missing" : service.trim() !== service ? "has spaces" : service.length < 40 ? "too short" : service === anon ? "same as anon key (wrong key)" : "ok",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "ok" : "missing",
  };
  let database = "not checked";
  if (checks.NEXT_PUBLIC_SUPABASE_URL === "ok" && checks.NEXT_PUBLIC_SUPABASE_ANON_KEY === "ok") {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/sizes?select=code&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: "no-store" });
      database = res.ok ? "ok" : res.status === 404 ? "tables missing: run supabase/setup-1-schema.sql" : res.status === 401 ? "anon key rejected" : `error ${res.status}`;
    } catch {
      database = "cannot reach Supabase";
    }
  }
  return NextResponse.json({ ...checks, database }, { headers: { "Cache-Control": "no-store" } });
}
