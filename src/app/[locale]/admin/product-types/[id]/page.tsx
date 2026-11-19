import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit, ConfirmSubmit } from "@/components/admin/form";
import { saveProductType, deleteProductType } from "@/lib/actions/admin/printing";
import { TypeEditor } from "@/components/admin/printing/type-editor";
import { normType, type ProductTypeRow } from "@/lib/print-config";
import type { Category, Color, Size } from "@/lib/types";

export default async function ProductTypePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data }, { data: colors }, { data: sizes }, { data: categories }] = await Promise.all([
    supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").eq("id", id).maybeSingle(),
    supabase.from("colors").select("*").order("sort_order"),
    supabase.from("sizes").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  if (!data) notFound();
  const type = normType(data as ProductTypeRow);
  const name = locale === "ar" ? type.name_ar : type.name_en;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        subtitle={t("الزوايا وصور الموك أب ومناطق الطباعة لهذا النوع. أي منتج من هذا النوع يأخذ هذه الإعدادات.", "Views, mockup photos and print areas for this type. Every product of this type uses them.")}
        actions={<>
          <Link href={`/${locale}/admin/product-types`} className="btn btn-outline btn-sm">{t("كل الأنواع", "All types")}</Link>
          <Link href={`/${locale}/admin/products/new?type=${type.id}`} className="btn btn-brand btn-sm">{t("منتج جديد من هذا النوع", "New product of this type")}</Link>
        </>}
      />
      <Card title={t("الزوايا ومناطق الطباعة", "Views & print areas")}>
        <TypeEditor type={type} colors={(colors as Color[]) ?? []} />
      </Card>
      <Card title={t("معلومات النوع والقيم الافتراضية للمنتجات", "Type details & product defaults")}>
        <AdminForm action={saveProductType} className="space-y-4">
          <input type="hidden" name="id" value={type.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} defaultValue={type.name_ar} required />
            <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} defaultValue={type.name_en} dir="ltr" />
            <Input name="default_price" type="number" min={0} step={250} label={t("السعر الافتراضي (د.ع)", "Default price (IQD)")} defaultValue={type.default_price} />
            <Select name="category_id" label={t("الفئة الافتراضية", "Default category")} defaultValue={type.category_id ?? ""} options={[{ value: "", label: "—" }, ...((categories as Category[]) ?? []).map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
            <Select name="garment_shape" label={t("رسم احتياطي (بدون صورة)", "Fallback drawing (no photo)")} defaultValue={type.garment_shape ?? ""} options={[{ value: "", label: t("بدون", "None") }, { value: "tshirt", label: t("تيشيرت", "T-shirt") }, { value: "oversized", label: t("أوفرسايز", "Oversized") }, { value: "hoodie", label: t("هودي", "Hoodie") }, { value: "sweatshirt", label: t("سويتشيرت", "Sweatshirt") }, { value: "longsleeve", label: t("كم طويل", "Long sleeve") }]} />
            <Input name="sort_order" type="number" min={0} label={t("الترتيب", "Order")} defaultValue={type.sort_order} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Textarea name="description_ar" label={t("وصف (عربي)", "Description (AR)")} defaultValue={type.description_ar ?? ""} rows={2} />
            <Textarea name="description_en" label={t("وصف (إنجليزي)", "Description (EN)")} defaultValue={type.description_en ?? ""} rows={2} dir="ltr" />
          </div>
          <div><p className="label">{t("المقاسات الافتراضية", "Default sizes")}</p><div className="flex flex-wrap gap-3">{((sizes as Size[]) ?? []).map((s) => <label key={s.code} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="default_sizes" value={s.code} defaultChecked={type.default_sizes.includes(s.code)} className="accent-ink" />{s.code}</label>)}</div></div>
          <div><p className="label">{t("الألوان الافتراضية", "Default colours")}</p><div className="flex flex-wrap gap-3">{((colors as Color[]) ?? []).map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="default_color_ids" value={c.id} defaultChecked={type.default_color_ids.includes(c.id)} className="accent-ink" /><span className="size-3.5 rounded-full border" style={{ background: c.hex }} />{locale === "ar" ? c.name_ar : c.name_en}</label>)}</div></div>
          <Checkbox name="is_active" label={t("يظهر عند إضافة منتج جديد", "Offered when adding a product")} defaultChecked={type.is_active} />
          <Submit>{t("حفظ", "Save")}</Submit>
        </AdminForm>
      </Card>
      <AdminForm action={deleteProductType} redirectTo={`/${locale}/admin/product-types`} className="flex justify-end">
        <input type="hidden" name="id" value={type.id} />
        <ConfirmSubmit message={t("حذف هذا النوع مع صوره ومناطقه؟ (لا يُسمح إذا كانت منتجات تستخدمه)", "Delete this type with its photos and areas? (not allowed while products use it)")}>{t("حذف النوع", "Delete type")}</ConfirmSubmit>
      </AdminForm>
    </div>
  );
}
