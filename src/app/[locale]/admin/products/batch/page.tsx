import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { BatchCreator } from "@/components/admin/batch-creator";
import { mockupFor, normType, type ProductTypeRow } from "@/lib/print-config";
import type { Category, Collection, Color, Size } from "@/lib/types";

export default async function BatchProducts({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> }) {
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
    supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").eq("is_active", true).order("sort_order"),
  ]);
  const types = ((typeRows as ProductTypeRow[]) ?? []).map(normType);
  const colorList = (colors as Color[]) ?? [];
  const type = types.find((x) => x.id === typeParam);

  if (!type) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("إضافة عدة منتجات مرة وحدة", "Add several products at once")} subtitle={t("اختار نوع المنتج، وبعدها ضيف كل منتج بتصميمه واسمه ومجموعته وانشرهن سوة.", "Choose the kind of product, then add each one with its artwork, name and collection — and publish them together.")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {types.map((ty) => {
            const v = ty.product_type_views?.[0];
            const c = colorList.find((x) => x.id === ty.default_color_ids[0]);
            const src = v ? mockupFor(v, ty.garment_shape, c ? { id: c.id, hex: c.hex } : null) : null;
            return (
              <Link key={ty.id} href={`/${locale}/admin/products/batch?type=${ty.id}`} className="card-admin group overflow-hidden transition hover:-translate-y-0.5 hover:border-pine hover:shadow-lg" data-ripple>
                <div className="grid aspect-square place-items-center bg-bone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src ? <img src={src} alt="" className="h-[82%] w-auto object-contain transition group-hover:scale-105" /> : <Package className="size-10 text-mute" />}
                </div>
                <p className="p-3 font-bold">{locale === "ar" ? ty.name_ar : ty.name_en}</p>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${t("عدة منتجات", "Several products")} — ${locale === "ar" ? type.name_ar : type.name_en}`}
        subtitle={t("الإعدادات المشتركة مرة وحدة، وبعدها لكل منتج: التصميم والاسم والمجموعة. «نشر الكل» يضيفهن سوة.", "Shared settings once, then for each product its artwork, name and collection. “Publish all” adds them together.")}
        actions={<><Link href={`/${locale}/admin/products/new?type=${type.id}`} className="btn btn-outline btn-sm">{t("منتج واحد", "Single product")}</Link><Link href={`/${locale}/admin/products/batch`} className="btn btn-outline btn-sm">{t("تغيير النوع", "Change type")}</Link></>}
      />
      <BatchCreator type={type} categories={(categories as Category[]) ?? []} collections={(collections as Collection[]) ?? []} sizes={(sizes as Size[]) ?? []} colors={colorList} />
    </div>
  );
}
