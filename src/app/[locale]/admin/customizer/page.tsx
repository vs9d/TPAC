import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Stat, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Textarea, Checkbox, Submit, ConfirmSubmit } from "@/components/admin/form";
import { saveGarmentType, savePrintLocation } from "@/lib/actions/admin/catalog";
import { PodImages } from "@/components/admin/printing/pod-images";
import { normType, type ProductTypeRow } from "@/lib/print-config";
import { saveDesignerOption, deleteDesignerOption, saveDesignerTier, deleteDesignerTier, saveDesignerSettings } from "@/lib/actions/admin/designer";
import { cn } from "@/lib/format";
import type { Color, DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow, Size } from "@/lib/types";

const TABS = ["images", "garments", "placements", "options", "tiers", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminCustomizer({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "images";
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data: g }, { data: l }, { data: colors }, { data: sizes }, { data: opts }, { data: tiers }, { data: st }, designs, week, orders] = await Promise.all([
    supabase.from("custom_garment_types").select("*").order("sort_order"),
    supabase.from("print_locations").select("*").order("sort_order"),
    supabase.from("colors").select("*").order("sort_order"),
    supabase.from("sizes").select("*").order("sort_order"),
    supabase.from("designer_options").select("*").order("sort_order"),
    supabase.from("designer_tiers").select("*").order("min_qty"),
    supabase.from("website_settings").select("value").eq("key", "designer").maybeSingle(),
    supabase.from("custom_designs").select("id", { count: "exact", head: true }),
    supabase.from("custom_designs").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("has_custom_items", true),
  ]);
  const podTypes = tab === "images" && g?.length
    ? (((await supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").in("code", (g as GarmentTypeRow[]).map((x) => x.code))).data as ProductTypeRow[]) ?? []).map(normType)
    : [];
  const options = (opts as DesignerOptionRow[]) ?? [];
  const tierRows = (tiers as DesignerTierRow[]) ?? [];
  const settings = { customer_uploads: true, lead_days_min: 3, lead_days_max: 5, rush_days: 2, min_dpi: 150, notice_ar: "", notice_en: "", ...((st?.value as Partial<DesignerSettings>) ?? {}) };
  const base = `/${locale}/admin/customizer`;
  const tabLabel: Record<Tab, string> = {
    images: t("صور الطباعة", "Printing images"),
    garments: t("القطع", "Garments"),
    placements: t("أماكن الطباعة", "Placements"),
    options: t("خيارات الطباعة", "Print options"),
    tiers: t("خصم الكمية", "Quantity discounts"),
    settings: t("الإعدادات", "Settings"),
  };
  const groups: { code: DesignerOptionRow["group_code"]; ar: string; en: string; hint_ar: string; hint_en: string }[] = [
    { code: "method", ar: "طريقة الطباعة", en: "Print method", hint_ar: "اختيار واحد — الافتراضي مجاني عادةً", hint_en: "Pick one — the default is usually free" },
    { code: "finish", ar: "اللمسة النهائية", en: "Finish", hint_ar: "اختيار واحد", hint_en: "Pick one" },
    { code: "fabric", ar: "الخامة", en: "Fabric", hint_ar: "اختيار واحد", hint_en: "Pick one" },
    { code: "package", ar: "التغليف", en: "Packaging", hint_ar: "اختيار واحد", hint_en: "Pick one" },
    { code: "addon", ar: "إضافات اختيارية", en: "Optional extras", hint_ar: "يمكن اختيار عدة إضافات", hint_en: "Customers can pick several" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("أداة التصميم والطباعة", "Print designer")}
        subtitle={t("السعر = سعر القطعة + أماكن الطباعة + خيارات الطباعة، ثم خصم الكمية. يُحسب دائماً على الخادم.", "Price = garment + placements + print options, then the quantity discount. Always computed server-side.")}
        actions={<Link href={`/${locale}/admin/designs`} className="btn btn-brand btn-sm">{t("تصاميم العملاء", "Customer designs")}</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("تصاميم محفوظة", "Saved designs")} value={designs.count ?? 0} />
        <Stat label={t("آخر ٧ أيام", "Last 7 days")} value={week.count ?? 0} />
        <Stat label={t("طلبات تحتوي طباعة", "Orders with printing")} value={orders.count ?? 0} />
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-full border border-line bg-bone p-1" aria-label="tabs">
        {TABS.map((x) => (
          <Link key={x} href={`${base}?tab=${x}`} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-bold transition", tab === x ? "bg-ink text-paper" : "text-mute hover:text-ink")} aria-current={tab === x ? "page" : undefined}>{tabLabel[x]}</Link>
        ))}
      </nav>

      {tab === "images" && (
        <Card title={t("صور القطع في «صمّم قطعتك»", "Garment images in “Design your piece”")}>
          <PodImages garments={(g as GarmentTypeRow[]) ?? []} types={podTypes} colors={(colors as Color[]) ?? []} />
        </Card>
      )}

      {tab === "garments" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {((g as GarmentTypeRow[]) ?? []).map((gt) => (
            <Card key={gt.code} title={`${locale === "ar" ? gt.name_ar : gt.name_en}${gt.is_active ? "" : ` — ${t("مخفية", "hidden")}`}`}>
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
                <Checkbox name="is_active" label={t("متاحة في أداة التصميم", "Available in the designer")} defaultChecked={gt.is_active} />
                <Submit>{t("حفظ", "Save")}</Submit>
              </AdminForm>
            </Card>
          ))}
        </div>
      )}

      {tab === "placements" && (
        <Card title={t("أماكن الطباعة", "Print placements")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {((l as PrintLocationRow[]) ?? []).map((p) => (
              <AdminForm key={p.code} action={savePrintLocation} className="space-y-2 rounded-2xl border border-line p-4">
                <input type="hidden" name="code" value={p.code} />
                <p className="font-semibold">{dict.designer.locations[p.code]}</p>
                <Input name="price" type="number" min={0} step={250} label={t("السعر (د.ع)", "Price (IQD)")} defaultValue={p.price} />
                <Checkbox name="is_active" label={t("متاح", "Enabled")} defaultChecked={p.is_active} />
                <Submit variant="outline">{t("حفظ", "Save")}</Submit>
              </AdminForm>
            ))}
          </div>
        </Card>
      )}

      {tab === "options" && (
        <div className="space-y-6">
          <p className="rounded-2xl bg-bone p-4 text-sm text-mute">{t("هذه الخيارات تظهر للزبون في تبويب «الطلب». السعر يُضاف لكل قطعة. اجعل خياراً واحداً «افتراضياً» في كل مجموعة، ويمكنك إخفاء أي خيار بدل حذفه.", "These appear in the customer's Order tab. Prices are added per piece. Mark one option per group as the default; hide an option instead of deleting it to keep history.")}</p>
          {groups.map((grp) => {
            const list = options.filter((o) => o.group_code === grp.code);
            return (
              <Card key={grp.code} title={`${locale === "ar" ? grp.ar : grp.en} — ${locale === "ar" ? grp.hint_ar : grp.hint_en}`}>
                <div className="space-y-3">
                  {list.length === 0 && <Empty>{t("لا خيارات بعد", "No options yet")}</Empty>}
                  {list.map((o) => (
                    <div key={o.id} className={cn("flex flex-col gap-2 rounded-2xl border border-line p-3 lg:flex-row lg:items-end", !o.is_active && "opacity-60")}>
                      <AdminForm action={saveDesignerOption} className="grid flex-1 gap-2 sm:grid-cols-6">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="group_code" value={o.group_code} />
                        <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} defaultValue={o.name_ar} className="sm:col-span-2" />
                        <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} defaultValue={o.name_en} className="sm:col-span-2" dir="ltr" />
                        <Input name="price" type="number" min={0} step={250} label={t("سعر/قطعة", "Price / piece")} defaultValue={o.price} />
                        <Input name="sort_order" type="number" min={0} label={t("الترتيب", "Order")} defaultValue={o.sort_order} />
                        <Input name="description_ar" label={t("وصف (عربي)", "Description (AR)")} defaultValue={o.description_ar ?? ""} className="sm:col-span-3" />
                        <Input name="description_en" label={t("وصف (إنجليزي)", "Description (EN)")} defaultValue={o.description_en ?? ""} className="sm:col-span-3" dir="ltr" />
                        <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
                          {grp.code !== "addon" && <Checkbox name="is_default" label={t("افتراضي", "Default")} defaultChecked={o.is_default} />}
                          <Checkbox name="is_active" label={t("ظاهر للزبون", "Visible")} defaultChecked={o.is_active} />
                          <Submit variant="outline">{t("حفظ", "Save")}</Submit>
                        </div>
                      </AdminForm>
                      <AdminForm action={deleteDesignerOption}>
                        <input type="hidden" name="id" value={o.id} />
                        <ConfirmSubmit message={t("حذف هذا الخيار؟", "Delete this option?")}>{t("حذف", "Delete")}</ConfirmSubmit>
                      </AdminForm>
                    </div>
                  ))}
                  <details className="rounded-2xl border border-dashed border-line p-3">
                    <summary className="cursor-pointer text-sm font-bold">+ {t("إضافة خيار", "Add an option")}</summary>
                    <AdminForm action={saveDesignerOption} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-6">
                      <input type="hidden" name="group_code" value={grp.code} />
                      <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} required className="sm:col-span-2" />
                      <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} required className="sm:col-span-2" dir="ltr" />
                      <Input name="code" label={t("رمز (لاتيني)", "Code (a-z, 0-9, _)")} required pattern="[a-z0-9_]{2,32}" dir="ltr" />
                      <Input name="price" type="number" min={0} step={250} label={t("سعر/قطعة", "Price / piece")} defaultValue={0} />
                      <Input name="description_ar" label={t("وصف (عربي)", "Description (AR)")} className="sm:col-span-3" />
                      <Input name="description_en" label={t("وصف (إنجليزي)", "Description (EN)")} className="sm:col-span-3" dir="ltr" />
                      <input type="hidden" name="sort_order" value={list.length + 1} />
                      <div className="flex items-center gap-4 sm:col-span-6"><Checkbox name="is_active" label={t("ظاهر للزبون", "Visible")} defaultChecked /><Submit>{t("إضافة", "Add")}</Submit></div>
                    </AdminForm>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "tiers" && (
        <Card title={t("خصم الكمية على قطع الطباعة", "Quantity discount on printed pieces")}>
          <p className="mb-4 text-sm text-mute">{t("يُطبَّق على مجموع قطع الطباعة في سلة الزبون (كل المقاسات والتصاميم معاً). أعلى شريحة تنطبق تُستخدم.", "Applies to the total number of printed pieces in the customer's bag (all sizes and designs together). The highest matching tier is used.")}</p>
          <div className="space-y-2">
            {tierRows.length === 0 && <Empty>{t("لا شرائح — لن يكون هناك خصم كمية", "No tiers — no quantity discount")}</Empty>}
            {tierRows.map((x) => (
              <div key={x.min_qty} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line p-3">
                <AdminForm action={saveDesignerTier} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="original_min_qty" value={x.min_qty} />
                  <Input name="min_qty" type="number" min={2} label={t("من (قطعة)", "From (pieces)")} defaultValue={x.min_qty} className="w-28" />
                  <Input name="discount_percent" type="number" min={1} max={60} label={t("الخصم %", "Discount %")} defaultValue={x.discount_percent} className="w-28" />
                  <Checkbox name="is_active" label={t("فعّال", "Active")} defaultChecked={x.is_active} />
                  <Submit variant="outline">{t("حفظ", "Save")}</Submit>
                </AdminForm>
                <AdminForm action={deleteDesignerTier}>
                  <input type="hidden" name="min_qty" value={x.min_qty} />
                  <ConfirmSubmit message={t("حذف هذه الشريحة؟", "Delete this tier?")}>{t("حذف", "Delete")}</ConfirmSubmit>
                </AdminForm>
              </div>
            ))}
            <AdminForm action={saveDesignerTier} resetOnSuccess className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-line p-3">
              <Input name="min_qty" type="number" min={2} label={t("من (قطعة)", "From (pieces)")} required className="w-28" />
              <Input name="discount_percent" type="number" min={1} max={60} label={t("الخصم %", "Discount %")} required className="w-28" />
              <input type="hidden" name="is_active" value="on" />
              <Submit>{t("إضافة شريحة", "Add tier")}</Submit>
            </AdminForm>
          </div>
        </Card>
      )}

      {tab === "settings" && (
        <Card title={t("الإعدادات العامة للمصمم", "Designer settings")}>
          <AdminForm action={saveDesignerSettings} className="space-y-4">
            <div className="rounded-2xl border border-line p-4">
              <Checkbox name="customer_uploads" label={t("السماح للزبائن برفع تصاميمهم الخاصة (صفحة «صمّم قطعتك»)", "Let customers upload their own designs (the “Design your piece” page)")} defaultChecked={settings.customer_uploads !== false} />
              <p className="mt-2 text-xs text-mute">{t("تصاميم المنتجات الرسمية يرفعها ويعدّلها المدير فقط دائماً. عند الإيقاف تختفي صفحة التصميم ويُرفض أي رفع من الزبائن.", "Official product artwork is always admin-only. When off, the design page closes and any customer upload is refused.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Input name="lead_days_min" type="number" min={0} max={60} label={t("أقل مدة تجهيز (أيام)", "Min production (days)")} defaultValue={settings.lead_days_min} />
              <Input name="lead_days_max" type="number" min={0} max={90} label={t("أطول مدة تجهيز (أيام)", "Max production (days)")} defaultValue={settings.lead_days_max} />
              <Input name="rush_days" type="number" min={0} max={30} label={t("مدة التجهيز السريع (أيام)", "Rush production (days)")} defaultValue={settings.rush_days} hint={t("تظهر عند اختيار إضافة «تجهيز سريع»", "Shown when the rush add-on is picked")} />
              <Input name="min_dpi" type="number" min={72} max={600} label={t("أقل دقة صورة (DPI)", "Min image DPI")} defaultValue={settings.min_dpi} hint={t("تحذير للزبون إن كانت الصورة أقل", "Customers are warned below this")} />
            </div>
            <Textarea name="notice_ar" label={t("تنبيه قبل التأكيد (عربي)", "Notice before confirming (AR)")} defaultValue={settings.notice_ar} rows={2} dir="rtl" />
            <Textarea name="notice_en" label={t("تنبيه قبل التأكيد (إنجليزي)", "Notice before confirming (EN)")} defaultValue={settings.notice_en} rows={2} dir="ltr" />
            <Submit>{t("حفظ", "Save")}</Submit>
            <p className="text-xs text-mute">{t("متاح للمدير فقط.", "Admins only.")}</p>
          </AdminForm>
        </Card>
      )}
    </div>
  );
}
