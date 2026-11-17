import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { VariantsTable } from "@/components/admin/variants-table";
import { deleteProduct } from "@/lib/actions/admin/products";
import { ConfirmSubmit } from "@/components/admin/form";
import type { Category, Collection, Color, Product, ProductImage, Size, Variant } from "@/lib/types";

export default async function EditProduct({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle<Product>();
  if (!product) notFound();
  const [{ data: categories }, { data: collections }, { data: pc }, { data: images }, { data: variants }, { data: colors }, { data: sizes }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("collections").select("*").order("sort_order"),
    supabase.from("product_collections").select("collection_id").eq("product_id", id),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("product_variants").select("*, inventory(quantity, low_stock_threshold)").eq("product_id", id),
    supabase.from("colors").select("*").order("sort_order"),
    supabase.from("sizes").select("*").order("sort_order"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "ar" ? product.name_ar : product.name_en}
        actions={<>
          {product.is_published && <Link href={`/${locale}/product/${product.slug}`} target="_blank" className="btn btn-outline btn-sm"><ExternalLink className="size-4" /> {t("عرض في المتجر", "View in store")}</Link>}
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="locale" value={locale} />
            <ConfirmSubmit message={t("حذف المنتج نهائياً؟", "Delete this product permanently?")}>{t("حذف المنتج", "Delete product")}</ConfirmSubmit>
          </form>
        </>}
      />
      <ProductForm product={product} categories={(categories as Category[]) ?? []} collections={(collections as Collection[]) ?? []} selectedCollections={(pc ?? []).map((x) => x.collection_id)} />
      <Card title={t("الصور", "Images")}><ProductImages productId={id} images={(images as ProductImage[]) ?? []} colors={(colors as Color[]) ?? []} /></Card>
      <Card title={t("المقاسات والألوان والأسعار", "Variants, sizes & prices")}><VariantsTable productId={id} variants={(variants as Variant[]) ?? []} colors={(colors as Color[]) ?? []} sizes={(sizes as Size[]) ?? []} basePrice={product.base_price} /></Card>
    </div>
  );
}
