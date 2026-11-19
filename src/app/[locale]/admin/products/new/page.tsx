import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, Settings2 } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { mockupFor, normType, type ProductTypeRow } from "@/lib/print-config";
import type { Category, Collection, Color, Size } from "@/lib/types";

export default async function NewProduct({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { type: typeParam } = await searchParams;
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: categories }, { data: collections }, { data: sizes }, { data: colors }, { data: typeRows }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("collections").select("*").order("sort_order"),
    supabase.from("sizes").select("*").order("sort_order"),
    supabase.from("colors").select("*").order("sort_order"),
    // missing until add-product-printing.sql has been run: then the plain form is shown straight away
    supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").eq("is_active", true).order("sort_order"),
  ]);
  const types = ((typeRows as ProductTypeRow[]) ?? []).map(normType);
  const colorList = (colors as Color[]) ?? [];
  const chosen = typeParam && typeParam !== "none" ? types.find((x) => x.id === typeParam) ?? null : null;

  // 1) pick what kind of product it is
  if (!typeParam && types.length) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("منتج جديد", "New product")} subtitle={t("اختر نوع المنتج. نحمّل صورته ومناطق الطباعة وقيمه الافتراضية تلقائياً.", "Choose the kind of product. Its mockup, print areas and defaults load automatically.")} actions={<Link href={`/${locale}/admin/product-types`} className="btn btn-outline btn-sm"><Settings2 className="size-4" /> {t("إدارة الأنواع", "Manage types")}</Link>} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {types.map((ty) => {
            const v = ty.product_type_views?.[0];
            const c = colorList.find((x) => x.id === ty.default_color_ids[0]);
            const src = v ? mockupFor(v, ty.garment_shape, c ? { id: c.id, hex: c.hex } : null) : null;
            const areas = (ty.product_type_views ?? []).flatMap((x) => x.product_print_areas ?? []).filter((a) => a.is_active);
            const main = areas[0];
            return (
              <Link key={ty.id} href={`/${locale}/admin/products/new?type=${ty.id}`} className="card-admin group overflow-hidden transition hover:-translate-y-0.5 hover:border-pine hover:shadow-lg" data-ripple>
                <div className="grid aspect-square place-items-center bg-bone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src ? <img src={src} alt="" className="h-[82%] w-auto object-contain transition group-hover:scale-105" /> : <Package className="size-10 text-mute" />}
                </div>
                <div className="p-3">
                  <p className="font-bold">{locale === "ar" ? ty.name_ar : ty.name_en}</p>
                  <p className="text-xs text-mute">{areas.length} {t("مناطق طباعة", "print areas")}{main ? ` · ${t("حتى", "up to")} ${main.max_width_cm}×${main.max_height_cm} cm` : ""}</p>
                </div>
              </Link>
            );
          })}
          <Link href={`/${locale}/admin/products/new?type=none`} className="card-admin grid place-items-center gap-2 border-dashed p-6 text-center transition hover:border-pine" data-ripple>
            <Package className="size-9 text-mute" />
            <span className="font-bold">{t("منتج مخصص", "Custom product")}</span>
            <span className="text-xs text-mute">{t("بدون قالب طباعة — صور عادية فقط", "No print template — regular photos only")}</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2) the product form, pre-filled from the type
  return (
    <div>
      <PageHeader
        title={chosen ? `${t("منتج جديد", "New product")} — ${locale === "ar" ? chosen.name_ar : chosen.name_en}` : t("منتج جديد", "New product")}
        subtitle={chosen ? t("ارفع التصميم وضعه على القطعة، ثم الاسم والسعر والمقاسات والألوان، واحفظ.", "Upload the artwork and place it, then name, price, sizes and colours — and save.") : t("كل شي بشاشة وحدة: المعلومات والصور والمقاسات والألوان والكمية.", "Everything on one screen: details, photos, sizes, colours and stock.")}
        actions={types.length ? <Link href={`/${locale}/admin/products/new`} className="btn btn-outline btn-sm">{t("تغيير النوع", "Change type")}</Link> : undefined}
      />
      <ProductForm key={chosen?.id ?? "plain"} printType={chosen} categories={(categories as Category[]) ?? []} collections={(collections as Collection[]) ?? []} selectedCollections={[]} sizes={(sizes as Size[]) ?? []} colors={colorList} />
    </div>
  );
}
