import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { ImportForm } from "@/components/admin/import-form";
import { IMPORT_COLUMNS } from "@/lib/product-tools";

export default async function ImportProducts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: cats }, { data: colors }, { data: sizes }] = await Promise.all([supabase.from("categories").select("slug"), supabase.from("colors").select("code"), supabase.from("sizes").select("code").order("sort_order")]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("استيراد منتجات من Excel / CSV", "Import products from Excel / CSV")}
        subtitle={t("أضف عشرات المنتجات مرة واحدة بمقاساتها وألوانها وكمياتها.", "Add dozens of products at once, with sizes, colours and stock.")}
        actions={<><a href="/api/admin/products?template=1" className="btn btn-outline btn-sm"><Download className="size-4" /> {t("تنزيل القالب", "Download template")}</a><Link href={`/${locale}/admin/products`} className="btn btn-ghost btn-sm">{t("رجوع", "Back")}</Link></>}
      />
      <Card title={t("كيف؟", "How it works")}>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed">
          <li>{t("نزّل القالب وافتحه بـ Excel أو Google Sheets.", "Download the template and open it in Excel or Google Sheets.")}</li>
          <li>{t("كل صف = منتج. الأعمدة المطلوبة: الاسم والسعر. الباقي اختياري.", "One row per product. Required: a name and price. Everything else is optional.")}</li>
          <li>{t("المقاسات والألوان تُكتب مفصولة بـ |  مثل", "Sizes and colours are separated with |  e.g.")} <code dir="ltr" className="rounded bg-bone px-1.5">S|M|L|XL</code> {t("و", "and")} <code dir="ltr" className="rounded bg-bone px-1.5">black|white</code></li>
          <li>{t("الكمية = لكل مقاس ولون. published: yes أو no.", "stock = per size & colour. published: yes or no.")}</li>
          <li>{t("احفظ كـ CSV وارفعه هنا. تظهر لك نتيجة كل صف.", "Save as CSV and upload it here. You'll see the result of every row.")}</li>
        </ol>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <div><dt className="font-bold text-mute">{t("الأعمدة", "Columns")}</dt><dd dir="ltr" className="mt-1 text-start leading-relaxed">{IMPORT_COLUMNS.join(", ")}</dd></div>
          <div><dt className="font-bold text-mute">{t("الفئات المتاحة (category)", "Categories (category)")}</dt><dd dir="ltr" className="mt-1 text-start leading-relaxed">{(cats ?? []).map((c) => c.slug).join(", ") || "—"}</dd></div>
          <div><dt className="font-bold text-mute">{t("الألوان (colors) والمقاسات (sizes)", "Colours (colors) & sizes (sizes)")}</dt><dd dir="ltr" className="mt-1 text-start leading-relaxed">{(colors ?? []).map((c) => c.code).join(", ")} · {(sizes ?? []).map((s) => s.code).join(", ")}</dd></div>
        </dl>
      </Card>
      <Card><ImportForm /></Card>
    </div>
  );
}
