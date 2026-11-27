import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveCommission, getCreatorSettings, getMyCreator, creatorBasePrice, creatorMaxMarkup } from "@/lib/creators";
import { getColors } from "@/lib/data/catalog";
import { normType, type ProductDesignRow, type ProductTypeRow } from "@/lib/print-config";
import { CreatorDesignEditor } from "@/components/creators/design-editor";

export default async function EditCreatorDesign({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const db = createAdminClient();
  const { data: cp } = await db.from("creator_products").select("*, products(slug)").eq("id", id).eq("creator_id", me.user_id).maybeSingle();
  if (!cp) notFound();
  const [{ data: typeRow }, colors, { data: designs }, { data: variants }, settings] = await Promise.all([
    db.from("product_types").select("*, product_type_views(*, product_print_areas(*))").eq("id", cp.product_type_id).maybeSingle(),
    getColors(),
    db.from("product_designs").select("*").eq("product_id", cp.product_id).order("sort_order"),
    db.from("product_variants").select("color_id, size_code, is_active").eq("product_id", cp.product_id),
    getCreatorSettings(),
  ]);
  if (!typeRow) notFound();
  const type = normType(typeRow as ProductTypeRow) as ProductTypeRow & { creator_max_markup?: number | null; creator_commission_mode?: string | null; creator_commission_value?: number | null };
  const active = ((variants ?? []) as { color_id: string; size_code: string; is_active: boolean }[]).filter((v) => v.is_active);
  return (
    <div className="space-y-4">
      <Link href={`/${locale}/creator-studio/designs`} className="text-sm font-semibold underline">{ar ? "← تصاميمي" : "← My designs"}</Link>
      <CreatorDesignEditor
        listing={{ id: cp.id, product_id: cp.product_id, title: cp.title, description: cp.description, category: cp.category, tags: cp.tags ?? [], markup: cp.markup, status: cp.status, review_note: cp.review_note, slug: (cp.products as { slug: string }).slug }}
        type={type} colors={colors} designs={(designs as ProductDesignRow[]) ?? []}
        chosenColors={[...new Set(active.map((v) => v.color_id))]} chosenSizes={[...new Set(active.map((v) => v.size_code))]}
        base={creatorBasePrice(type as { default_price: number; creator_base_price?: number | null })} maxMarkup={creatorMaxMarkup(type, settings)}
        rule={effectiveCommission(me, type, settings)} reviewRequired={settings.review_required}
      />
    </div>
  );
}
