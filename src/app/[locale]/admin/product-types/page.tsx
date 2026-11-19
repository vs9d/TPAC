import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Submit } from "@/components/admin/form";
import { saveProductType } from "@/lib/actions/admin/printing";
import { mockupFor, normType, type ProductTypeRow } from "@/lib/print-config";
import { formatIQD } from "@/lib/format";
import type { Color } from "@/lib/types";

export default async function ProductTypes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data, error }, { data: colors }, { data: counts }] = await Promise.all([
    supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").order("sort_order"),
    supabase.from("colors").select("*"),
    supabase.from("products").select("product_type_id").not("product_type_id", "is", null),
  ]);
  const types = ((data as ProductTypeRow[]) ?? []).map(normType);
  const used = new Map<string, number>();
  for (const p of counts ?? []) used.set(p.product_type_id as string, (used.get(p.product_type_id as string) ?? 0) + 1);
  const colorById = new Map(((colors as Color[]) ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("أنواع المنتجات والطباعة", "Product types & printing")} subtitle={t("لكل نوع صور موك أب خاصة به وزوايا ومناطق طباعة بأبعاد بالسنتيمتر. المنتجات الجديدة تبدأ من هنا.", "Each type has its own mockup photos, views and print areas sized in cm. New products start from here.")} />
      {error && <p className="rounded-2xl border border-amber bg-amber/10 p-4 text-sm">{t("شغّل الملف supabase/add-product-printing-1.sql ثم -2.sql في Supabase لتفعيل هذا القسم.", "Run supabase/add-product-printing-1.sql then -2.sql in Supabase to enable this section.")}</p>}
      {types.length === 0 && !error ? <Empty>{t("لا توجد أنواع", "No types yet")}</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {types.map((ty) => {
            const front = ty.product_type_views?.[0];
            const c = colorById.get(ty.default_color_ids[0] ?? "");
            const src = front ? mockupFor(front, ty.garment_shape, c ? { id: c.id, hex: c.hex } : null) : null;
            const areas = (ty.product_type_views ?? []).reduce((n, v) => n + (v.product_print_areas ?? []).length, 0);
            return (
              <Link key={ty.id} href={`/${locale}/admin/product-types/${ty.id}`} className="card-admin group overflow-hidden transition hover:border-pine">
                <div className="grid aspect-[4/3] place-items-center bg-bone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src ? <img src={src} alt="" className="h-[85%] w-auto object-contain transition group-hover:scale-[1.03]" /> : <span className="text-xs text-mute">{t("بدون صورة", "No image")}</span>}
                </div>
                <div className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{locale === "ar" ? ty.name_ar : ty.name_en}</p>
                    {!ty.is_active && <Pill>{t("مخفي", "Hidden")}</Pill>}
                  </div>
                  <p className="text-xs text-mute">{(ty.product_type_views ?? []).length} {t("زوايا", "views")} · {areas} {t("مناطق طباعة", "print areas")} · {used.get(ty.id) ?? 0} {t("منتج", "products")}</p>
                  <p className="text-xs text-mute">{t("السعر الافتراضي", "Default price")}: {formatIQD(ty.default_price, locale)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Card title={t("نوع جديد", "New type")}>
        <AdminForm action={saveProductType} redirectTo={`/${locale}/admin/product-types/{id}`} className="grid gap-3 sm:grid-cols-4">
          <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} required placeholder={t("مثلاً: حقيبة قماش", "e.g. Tote bag")} />
          <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} dir="ltr" placeholder="Tote bag" />
          <Input name="default_price" type="number" min={0} step={250} label={t("السعر الافتراضي", "Default price")} defaultValue={0} />
          <input type="hidden" name="is_active" value="on" />
          <div className="flex items-end"><Submit className="w-full">{t("إنشاء النوع", "Create type")}</Submit></div>
        </AdminForm>
        <p className="mt-3 text-xs text-mute">{t("يُنشأ النوع بزاويتين (أمام وخلف) ومنطقة طباعة بكل زاوية. بعدها ارفع صوره وعدّل المناطق.", "The type starts with a front and a back view, each with one print area. Then upload its photos and adjust the areas.")}</p>
      </Card>
    </div>
  );
}
