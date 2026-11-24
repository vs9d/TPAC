import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pagination, Empty } from "@/components/admin/ui";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

const PAGE_SIZE = 40;

export default async function AdminProducts({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; stock?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const term = sp.q?.replace(/[%_,()]/g, "");
  let q = supabase
    .from("products")
    .select("id, slug, name_ar, name_en, base_price, is_published, is_featured, is_limited, is_new_arrival, sales_count, category:categories(name_ar, name_en), product_images(url, sort_order), product_variants(id, inventory(quantity))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (term) q = q.or(`name_ar.ilike.%${term}%,name_en.ilike.%${term}%,slug.ilike.%${term}%`);
  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.status === "published") q = q.eq("is_published", true);
  if (sp.status === "hidden") q = q.eq("is_published", false);
  const [{ data, count }, { data: categories }, { data: collections }] = await Promise.all([
    q,
    supabase.from("categories").select("id, name_ar, name_en").order("sort_order"),
    supabase.from("collections").select("id, name_ar, name_en").order("sort_order"),
  ]);
  type Raw = { id: string; slug: string; name_ar: string; name_en: string; base_price: number; is_published: boolean; is_featured: boolean; is_limited: boolean; is_new_arrival: boolean; sales_count: number; category: { name_ar: string; name_en: string } | null; product_images: { url: string; sort_order: number }[]; product_variants: { id: string; inventory: { quantity: number } | null }[] };
  let rows: ProductRow[] = ((data ?? []) as unknown as Raw[]).map((p) => ({
    id: p.id, slug: p.slug, name_ar: p.name_ar, name_en: p.name_en, base_price: p.base_price, is_published: p.is_published, is_featured: p.is_featured, is_limited: p.is_limited, is_new_arrival: p.is_new_arrival, sales_count: p.sales_count,
    category: p.category ? (locale === "ar" ? p.category.name_ar : p.category.name_en) : null,
    image: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null,
    stock: p.product_variants.reduce((n, v) => n + (v.inventory?.quantity ?? 0), 0),
    variants: p.product_variants.length,
  }));
  if (sp.stock === "out") rows = rows.filter((r) => r.stock === 0);
  if (sp.stock === "low") rows = rows.filter((r) => r.stock > 0 && r.stock < 10);
  const keep = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  return (
    <div>
      <PageHeader
        title={t("المنتجات", "Products")}
        subtitle={`${count ?? 0}`}
        actions={<>
          <a href="/api/admin/products" className="btn btn-outline btn-sm"><Download className="size-4" /> CSV</a>
          <Link href={`/${locale}/admin/products/import`} className="btn btn-outline btn-sm"><Upload className="size-4" /> {t("استيراد", "Import")}</Link>
          <Link href={`/${locale}/admin/products/batch`} className="btn btn-outline btn-sm"><Plus className="size-4" /> {t("عدة منتجات", "Several at once")}</Link>
          <Link href={`/${locale}/admin/products/new`} className="btn btn-brand btn-sm"><Plus className="size-4" /> {t("منتج جديد", "New product")}</Link>
        </>}
      />
      <form className="card-admin mb-4 grid gap-3 p-4 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder={t("بحث بالاسم أو الرابط", "Search name or slug")} className="field h-10 text-sm sm:col-span-2" />
        <select name="category" defaultValue={sp.category ?? ""} className="field h-10 text-sm">
          <option value="">{t("كل الفئات", "All categories")}</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="field h-10 text-sm">
          <option value="">{t("كل الحالات", "All statuses")}</option>
          <option value="published">{t("منشور", "Published")}</option>
          <option value="hidden">{t("مخفي", "Hidden")}</option>
        </select>
        <div className="flex gap-2">
          <select name="stock" defaultValue={sp.stock ?? ""} className="field h-10 text-sm">
            <option value="">{t("كل المخزون", "Any stock")}</option>
            <option value="out">{t("نفد", "Out of stock")}</option>
            <option value="low">{t("منخفض", "Low")}</option>
          </select>
          <button className="btn btn-primary btn-sm h-10">{t("بحث", "Filter")}</button>
        </div>
      </form>
      <div className="card-admin p-0">
        {rows.length === 0 ? <Empty>{t("لا توجد منتجات", "No products")}</Empty> : <div className="p-3"><ProductsTable rows={rows} categories={categories ?? []} collections={collections ?? []} /></div>}
        <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={(p) => `?${new URLSearchParams({ ...keep, page: String(p) } as Record<string, string>)}`} />
      </div>
    </div>
  );
}
