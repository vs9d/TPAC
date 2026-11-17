import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/form";
import { saveColor, deleteColor, saveSize, deleteSize } from "@/lib/actions/admin/catalog";
import type { Color, Size } from "@/lib/types";

export default async function AdminAttributes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: colors }, { data: sizes }] = await Promise.all([supabase.from("colors").select("*").order("sort_order"), supabase.from("sizes").select("*").order("sort_order")]);
  const colorRow = (c?: Color) => (
    <AdminForm action={saveColor} resetOnSuccess={!c} className="grid grid-cols-[auto_1fr_1fr_1fr_5rem_auto] items-center gap-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="color" name="hex" defaultValue={c?.hex ?? "#000000"} className="size-9 cursor-pointer border border-line" aria-label="hex" />
      <input name="code" defaultValue={c?.code} required placeholder="code" className="field h-9 px-2 text-sm" dir="ltr" />
      <input name="name_ar" defaultValue={c?.name_ar} required placeholder="عربي" className="field h-9 px-2 text-sm" />
      <input name="name_en" defaultValue={c?.name_en} required placeholder="English" className="field h-9 px-2 text-sm" dir="ltr" />
      <input name="sort_order" type="number" defaultValue={c?.sort_order ?? 0} className="field h-9 px-2 text-sm" />
      <Submit variant={c ? "outline" : "primary"} className="h-9">{c ? "✓" : t("إضافة", "Add")}</Submit>
    </AdminForm>
  );
  return (
    <div className="space-y-8">
      <PageHeader title={t("الألوان والمقاسات", "Colours & sizes")} />
      <Card title={t("الألوان", "Colours")}>
        <div className="space-y-2">
          {((colors as Color[]) ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <div className="flex-1">{colorRow(c)}</div>
              <AdminForm action={deleteColor}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف", "Delete")}</button></AdminForm>
            </div>
          ))}
          <div className="border-t border-line pt-3">{colorRow()}</div>
        </div>
      </Card>
      <Card title={t("المقاسات", "Sizes")}>
        <div className="space-y-2">
          {((sizes as Size[]) ?? []).map((s) => (
            <div key={s.code} className="flex items-center gap-2">
              <AdminForm action={saveSize} className="grid flex-1 grid-cols-[6rem_1fr_5rem_auto] gap-2">
                <input name="code" defaultValue={s.code} readOnly className="field h-9 bg-bone px-2 text-sm" dir="ltr" />
                <input name="label" defaultValue={s.label} className="field h-9 px-2 text-sm" />
                <input name="sort_order" type="number" defaultValue={s.sort_order} className="field h-9 px-2 text-sm" />
                <Submit variant="outline" className="h-9">✓</Submit>
              </AdminForm>
              <AdminForm action={deleteSize}><input type="hidden" name="code" value={s.code} /><button className="text-xs text-danger underline">{t("حذف", "Delete")}</button></AdminForm>
            </div>
          ))}
          <AdminForm action={saveSize} resetOnSuccess className="grid grid-cols-[6rem_1fr_5rem_auto] gap-2 border-t border-line pt-3">
            <input name="code" required placeholder="4XL" className="field h-9 px-2 text-sm uppercase" dir="ltr" />
            <input name="label" required placeholder="4XL" className="field h-9 px-2 text-sm" />
            <input name="sort_order" type="number" defaultValue={10} className="field h-9 px-2 text-sm" />
            <Submit className="h-9">{t("إضافة", "Add")}</Submit>
          </AdminForm>
        </div>
      </Card>
    </div>
  );
}
