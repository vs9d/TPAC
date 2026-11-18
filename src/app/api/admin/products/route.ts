import { NextResponse, type NextRequest } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvCell, IMPORT_TEMPLATE } from "@/lib/product-tools";

/** GET /api/admin/products            -> CSV of all products
 *  GET /api/admin/products?template=1 -> blank import template */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  const headers = { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" };
  if (req.nextUrl.searchParams.get("template")) {
    return new NextResponse("﻿" + IMPORT_TEMPLATE, { headers: { ...headers, "Content-Disposition": 'attachment; filename="tpac-products-template.csv"' } });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, name_ar, name_en, base_price, compare_at_price, is_published, sales_count, category:categories(slug), product_variants(size_code, color:colors(code), inventory(quantity))")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  type Row = { slug: string; name_ar: string; name_en: string; base_price: number; compare_at_price: number | null; is_published: boolean; sales_count: number; category: { slug: string } | null; product_variants: { size_code: string; color: { code: string } | null; inventory: { quantity: number } | null }[] };
  const head = ["slug", "name_ar", "name_en", "price", "compare_at_price", "category", "published", "sizes", "colors", "stock_total", "sold"];
  const lines = ((data ?? []) as unknown as Row[]).map((p) =>
    [
      p.slug, p.name_ar, p.name_en, p.base_price, p.compare_at_price ?? "", p.category?.slug ?? "", p.is_published ? "yes" : "no",
      [...new Set(p.product_variants.map((v) => v.size_code))].join("|"),
      [...new Set(p.product_variants.map((v) => v.color?.code).filter(Boolean))].join("|"),
      p.product_variants.reduce((n, v) => n + (v.inventory?.quantity ?? 0), 0), p.sales_count,
    ].map(csvCell).join(","),
  );
  return new NextResponse("﻿" + [head.join(","), ...lines].join("\r\n"), { headers: { ...headers, "Content-Disposition": `attachment; filename="tpac-products-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
