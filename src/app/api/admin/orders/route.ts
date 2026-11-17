import { NextResponse, type NextRequest } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { queryOrders } from "@/lib/data/admin-orders";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // neutralise spreadsheet formula injection and quote everything
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV export of orders with the same filters as the admin table. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const cols = "order_number, created_at, status, payment_method, payment_status, customer_name, phone, email, governorate, city, address_line, delivery_method, subtotal, discount_total, delivery_fee, total, discount_code, source";
  const { data, error } = await queryOrders({ q: p.get("q") ?? undefined, status: p.get("status") ?? undefined, from: p.get("from") ?? undefined, to: p.get("to") ?? undefined }, cols);
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  const header = cols.split(", ");
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => header.map((h) => csv(r[h])).join(","));
  const body = "﻿" + [header.join(","), ...rows].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tpac-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
