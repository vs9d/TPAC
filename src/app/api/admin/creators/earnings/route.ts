import { NextResponse, type NextRequest } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // spreadsheet-safe: quote, double quotes, and neutralise formulas
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Staff only: creator earnings (or withdrawals) as CSV for a date range. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) return new NextResponse("Forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") ?? "") ? sp.get("from")! : "2000-01-01";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to") ?? "") ? sp.get("to")! : new Date().toISOString().slice(0, 10);
  const db = createAdminClient();
  let rows: unknown[][];
  let name: string;
  if (sp.get("kind") === "withdrawals") {
    const { data } = await db.from("creator_withdrawals").select("created_at, amount, method, account, status, processed_at, admin_note, creators(username, display_name)").order("created_at");
    rows = [["date", "creator", "username", "amount", "method", "account", "status", "processed_at", "note"], ...((data ?? []) as unknown as { created_at: string; amount: number; method: string; account: string; status: string; processed_at: string | null; admin_note: string | null; creators: { username: string; display_name: string } }[]).map((w) => [w.created_at, w.creators?.display_name, w.creators?.username, w.amount, w.method, w.account, w.status, w.processed_at, w.admin_note])];
    name = "creator-withdrawals";
  } else {
    const { data } = await db.from("creator_earnings").select("created_at, order_number, product_name, size_code, quantity, unit_price, base_price, markup, commission_mode, commission_value, amount, status, void_reason, available_at, creators(username, display_name)").gte("created_at", from).lte("created_at", `${to}T23:59:59`).order("created_at");
    rows = [["date", "order", "creator", "username", "design", "size", "qty", "unit_price", "base_price", "markup", "rule", "rule_value", "creator_earning", "platform_share", "status", "void_reason", "available_at"],
      ...((data ?? []) as unknown as { created_at: string; order_number: string; product_name: string; size_code: string | null; quantity: number; unit_price: number; base_price: number; markup: number; commission_mode: string; commission_value: number; amount: number; status: string; void_reason: string | null; available_at: string | null; creators: { username: string; display_name: string } }[])
        .map((e) => [e.created_at, e.order_number, e.creators?.display_name, e.creators?.username, e.product_name, e.size_code, e.quantity, e.unit_price, e.base_price, e.markup, e.commission_mode, e.commission_value, e.amount, e.unit_price * e.quantity - e.amount, e.status, e.void_reason, e.available_at])];
    name = `creator-earnings-${from}-${to}`;
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
}
