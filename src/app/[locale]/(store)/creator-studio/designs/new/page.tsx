import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCreatorSettings } from "@/lib/creators";
import { mockupFor, normType, type ProductTypeRow } from "@/lib/print-config";
import { NewDesignButton } from "@/components/creators/new-design-button";
import { formatIQD } from "@/lib/format";

export default async function NewCreatorDesign({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const [{ data }, s] = await Promise.all([
    createAdminClient().from("product_types").select("*, product_type_views(*, product_print_areas(*))").eq("is_active", true).eq("creator_enabled", true).order("sort_order"),
    getCreatorSettings(),
  ]);
  const types = ((data as (ProductTypeRow & { creator_max_markup: number | null })[]) ?? []).map((t) => ({ ...normType(t), creator_max_markup: t.creator_max_markup }));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-2xl">{ar ? "على أي قطعة تحط تصميمك؟" : "Which garment is it for?"}</h2>
        <p className="mt-1 text-sm text-mute">{ar ? "السعر الأساسي من TPAC، وأنت تحدد اللي تضيفه بالخطوة الجاية." : "The base price is TPAC's; you choose your markup next."}</p>
      </div>
      {types.length === 0 ? <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "ماكو قطع متاحة للمبدعين حالياً — نضيفها قريباً." : "No garments open to creators yet."}</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {types.map((t) => {
            const v = t.product_type_views?.[0];
            const img = v ? mockupFor(v, t.garment_shape) : null;
            return (
              <NewDesignButton key={t.id} typeId={t.id} className="group overflow-hidden rounded-[1.25rem] border border-line bg-paper text-start transition hover:-translate-y-0.5 hover:border-pine">
                <div className="relative aspect-square bg-bone">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="absolute inset-0 size-full object-contain p-3" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold">{ar ? t.name_ar : t.name_en}</p>
                  <p className="text-xs text-mute">{ar ? "سعر TPAC" : "TPAC price"} {formatIQD(t.default_price, locale)} · {ar ? "تضيف لحد" : "add up to"} {formatIQD(t.creator_max_markup ?? s.max_markup, locale)}</p>
                </div>
              </NewDesignButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
