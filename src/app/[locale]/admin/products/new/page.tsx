import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import type { Category, Collection } from "@/lib/types";

export default async function NewProduct({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: categories }, { data: collections }] = await Promise.all([supabase.from("categories").select("*").order("sort_order"), supabase.from("collections").select("*").order("sort_order")]);
  return (
    <div>
      <PageHeader title={t("منتج جديد", "New product")} subtitle={t("بعد الإنشاء ستتمكن من إضافة الصور والمقاسات والألوان.", "After creating, you can add images, sizes and colours.")} />
      <ProductForm categories={(categories as Category[]) ?? []} collections={(collections as Collection[]) ?? []} selectedCollections={[]} />
    </div>
  );
}
