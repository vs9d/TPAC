import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Input, Checkbox, Submit } from "@/components/admin/form";
import { saveGarmentType, savePrintLocation } from "@/lib/actions/admin/catalog";
import type { Color, GarmentTypeRow, PrintLocationRow, Size } from "@/lib/types";

export default async function AdminCustomizer({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const [{ data: g }, { data: l }, { data: colors }, { data: sizes }] = await Promise.all([
    supabase.from("custom_garment_types").select("*").order("sort_order"),
    supabase.from("print_locations").select("*").order("sort_order"),
    supabase.from("colors").select("*").order("sort_order"),
    supabase.from("sizes").select("*").order("sort_order"),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title={t("تسعير أداة التصميم", "Designer pricing")} subtitle={t("السعر = سعر القطعة + سعر كل مكان طباعة مستخدم. يُحسب دائماً على الخادم.", "Price = garment price + each used print placement. Always computed server-side.")} />
      <Card title={t("أماكن الطباعة", "Print placements")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {((l as PrintLocationRow[]) ?? []).map((p) => (
            <AdminForm key={p.code} action={savePrintLocation} className="space-y-2 border border-line p-4">
              <input type="hidden" name="code" value={p.code} />
              <p className="font-semibold">{dict.designer.locations[p.code]}</p>
              <Input name="price" type="number" min={0} step={250} label={t("السعر (د.ع)", "Price (IQD)")} defaultValue={p.price} />
              <Checkbox name="is_active" label={t("متاح", "Enabled")} defaultChecked={p.is_active} />
              <Submit variant="outline">{t("حفظ", "Save")}</Submit>
            </AdminForm>
          ))}
        </div>
      </Card>
      {((g as GarmentTypeRow[]) ?? []).map((gt) => (
        <Card key={gt.code} title={locale === "ar" ? gt.name_ar : gt.name_en}>
          <AdminForm action={saveGarmentType} className="space-y-4">
            <input type="hidden" name="code" value={gt.code} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} defaultValue={gt.name_ar} />
              <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} defaultValue={gt.name_en} />
              <Input name="base_price" type="number" min={0} step={250} label={t("سعر القطعة", "Garment price")} defaultValue={gt.base_price} />
            </div>
            <div><p className="label">{t("الألوان المتاحة", "Available colours")}</p><div className="flex flex-wrap gap-3">{((colors as Color[]) ?? []).map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="color_ids" value={c.id} defaultChecked={gt.color_ids.includes(c.id)} className="accent-ink" /><span className="size-3.5 rounded-full border" style={{ background: c.hex }} />{locale === "ar" ? c.name_ar : c.name_en}</label>)}</div></div>
            <div><p className="label">{t("المقاسات", "Sizes")}</p><div className="flex flex-wrap gap-3">{((sizes as Size[]) ?? []).map((s) => <label key={s.code} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="sizes" value={s.code} defaultChecked={gt.sizes.includes(s.code)} className="accent-ink" />{s.code}</label>)}</div></div>
            <div><p className="label">{t("أماكن الطباعة المسموحة", "Allowed placements")}</p><div className="flex flex-wrap gap-3">{["front", "back", "left_chest", "sleeve", "sleeve_left"].map((p) => <label key={p} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="print_locations" value={p} defaultChecked={gt.print_locations.includes(p)} className="accent-ink" />{dict.designer.locations[p]}</label>)}</div></div>
            <Checkbox name="is_active" label={t("متاح في أداة التصميم", "Available in designer")} defaultChecked={gt.is_active} />
            <Submit>{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
      ))}
    </div>
  );
}
