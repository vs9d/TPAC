import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import type { Category, Collection, Color, Size } from "@/lib/types";

export default async function NewProduct({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: categories }, { data: collections }, { data: sizes }, { data: colors }] = await Promise.all([supabase.from("categories").select("*").order("sort_order"), supabase.from("collections").select("*").order("sort_order"), supabase.from("sizes").select("*").order("sort_order"), supabase.from("colors").select("*").order("sort_order")]);
  return (
    <div>
      <PageHeader title={t("منتج جديد", "New product")} subtitle={t("كل شي بشاشة وحدة: المعلومات والصور والمقاسات والألوان والكمية. تكدر تنسخ أي منتج موجود من قائمة المنتجات.", "Everything on one screen: details, photos, sizes, colours and stock. You can also duplicate any existing product from the list.")} />
      <ProductForm categories={(categories as Category[]) ?? []} collections={(collections as Collection[]) ?? []} selectedCollections={[]} sizes={(sizes as Size[]) ?? []} colors={(colors as Color[]) ?? []} />
    </div>
  );
}
