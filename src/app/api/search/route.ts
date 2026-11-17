import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/data/catalog";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    const { items } = await searchProducts({ q, limit: 6, sort: "popular" });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}
