import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Pagination, Empty } from "@/components/admin/ui";
import { formatIQD } from "@/lib/format";

const PAGE_SIZE = 40;

export default async function AdminProducts({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select("id, slug, name_ar, name_en, base_price, is_published, is_featured, is_limited, sales_count, category:categories(name_ar, name_en), product_images(url, sort_order), product_variants(id, inventory(quantity))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (sp.q) q = q.or(`name_ar.ilike.%${sp.q.replace(/[%_,()]/g, "")}%,name_en.ilike.%${sp.q.replace(/[%_,()]/g, "")}%,slug.ilike.%${sp.q.replace(/[%_,()]/g, "")}%`);
  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.status === "published") q = q.eq("is_published", true);
  if (sp.status === "hidden") q = q.eq("is_published", false);
  const [{ data, count }, { data: categories }] = await Promise.all([q, supabase.from("categories").select("id, name_ar, name_en").order("sort_order")]);
  type Row = { id: string; slug: string; name_ar: string; name_en: string; base_price: number; is_published: boolean; is_featured: boolean; is_limited: boolean; sales_count: number; category: { name_ar: string; name_en: string } | null; product_images: { url: string; sort_order: number }[]; product_variants: { id: string; inventory: { quantity: number } | null }[] };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <PageHeader title={t("المنتجات", "Products")} subtitle={`${count ?? 0}`} actions={<Link href={`/${locale}/admin/products/new`} className="btn btn-primary btn-sm"><Plus className="size-4" /> {t("منتج جديد", "New product")}</Link>} />
      <form className="card-admin mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder={t("بحث بالاسم أو الرابط", "Search name or slug")} className="field h-10 text-sm sm:col-span-2" />
        <select name="category" defaultValue={sp.category ?? ""} className="field h-10 text-sm">
          <option value="">{t("كل الفئات", "All categories")}</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="status" defaultValue={sp.status ?? ""} className="field h-10 text-sm">
            <option value="">{t("الكل", "All")}</option>
            <option value="published">{t("منشور", "Published")}</option>
            <option value="hidden">{t("مخفي", "Hidden")}</option>
          </select>
          <button className="btn btn-primary btn-sm h-10">{t("بحث", "Filter")}</button>
        </div>
      </form>
      <div className="card-admin overflow-x-auto">
        {rows.length === 0 ? <Empty>{t("لا توجد منتجات", "No products")}</Empty> : (
          <table className="table-admin">
            <thead><tr><th></th><th>{t("المنتج", "Product")}</th><th>{t("الفئة", "Category")}</th><th>{t("السعر", "Price")}</th><th>{t("المخزون", "Stock")}</th><th>{t("المبيعات", "Sold")}</th><th>{t("الحالة", "Status")}</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const stock = p.product_variants.reduce((n, v) => n + (v.inventory?.quantity ?? 0), 0);
                const img = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
                return (
                  <tr key={p.id}>
                    <td className="w-14"><div className="relative h-14 w-11 bg-bone">{img && <Image src={img} alt="" fill sizes="44px" className="object-cover" />}</div></td>
                    <td><Link href={`/${locale}/admin/products/${p.id}`} className="font-semibold hover:underline">{locale === "ar" ? p.name_ar : p.name_en}</Link><span className="block text-xs text-mute" dir="ltr">/{p.slug}</span></td>
                    <td>{p.category ? (locale === "ar" ? p.category.name_ar : p.category.name_en) : "—"}</td>
                    <td className="tabular-nums">{formatIQD(p.base_price, locale)}</td>
                    <td><Pill tone={stock === 0 ? "bad" : stock < 10 ? "warn" : "neutral"}>{stock} · {p.product_variants.length} {t("نوع", "var.")}</Pill></td>
                    <td className="tabular-nums">{p.sales_count}</td>
                    <td className="space-x-1 rtl:space-x-reverse">{p.is_published ? <Pill tone="good">{t("منشور", "Live")}</Pill> : <Pill>{t("مخفي", "Hidden")}</Pill>}{p.is_featured && <Pill tone="dark">★</Pill>}{p.is_limited && <Pill tone="warn">LTD</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={(p) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) } as Record<string, string>)}`} />
      </div>
    </div>
  );
}
