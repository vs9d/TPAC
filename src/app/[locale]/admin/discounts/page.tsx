import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Select, Checkbox, Submit } from "@/components/admin/form";
import { saveDiscount, deleteDiscount } from "@/lib/actions/admin/marketing";
import { formatIQD, toBaghdadInput } from "@/lib/format";

type Code = { id: string; code: string; description: string | null; type: string; value: number; min_order_total: number; max_discount: number | null; max_uses: number | null; max_uses_per_customer: number | null; used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean };

export default async function AdminDiscounts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
  const local = toBaghdadInput;
  const fields = (c?: Code) => (
    <div className="grid gap-3 sm:grid-cols-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Input name="code" label={t("الكود", "Code")} defaultValue={c?.code} required dir="ltr" className="uppercase" />
      <Select name="type" label={t("النوع", "Type")} defaultValue={c?.type ?? "percent"} options={[{ value: "percent", label: t("نسبة ٪", "Percent %") }, { value: "fixed", label: t("مبلغ ثابت", "Fixed amount") }, { value: "free_shipping", label: t("توصيل مجاني", "Free shipping") }]} />
      <Input name="value" type="number" min={0} label={t("القيمة", "Value")} defaultValue={c?.value ?? 10} />
      <Input name="min_order_total" type="number" min={0} label={t("حد أدنى للطلب", "Min order")} defaultValue={c?.min_order_total ?? 0} />
      <Input name="max_discount" type="number" min={0} label={t("أقصى خصم", "Max discount")} defaultValue={c?.max_discount ?? ""} />
      <Input name="max_uses" type="number" min={1} label={t("عدد الاستخدامات الكلي", "Total uses")} defaultValue={c?.max_uses ?? ""} />
      <Input name="max_uses_per_customer" type="number" min={1} label={t("لكل عميل", "Per customer")} defaultValue={c?.max_uses_per_customer ?? ""} />
      <Input name="description" label={t("الوصف", "Description")} defaultValue={c?.description ?? ""} />
      <Input name="starts_at" type="datetime-local" label={t("يبدأ", "Starts")} defaultValue={local(c?.starts_at ?? null)} />
      <Input name="ends_at" type="datetime-local" label={t("ينتهي", "Ends")} defaultValue={local(c?.ends_at ?? null)} />
      <Checkbox name="is_active" label={t("فعال", "Active")} defaultChecked={c?.is_active ?? true} className="self-end pb-2" />
    </div>
  );
  return (
    <div className="space-y-6">
      <PageHeader title={t("أكواد الخصم", "Discount codes")} subtitle={t("تُتحقق الأكواد وتُحسب على الخادم فقط.", "Codes are validated and applied on the server only.")} />
      <Card title={t("كود جديد", "New code")}><AdminForm action={saveDiscount} resetOnSuccess className="space-y-3">{fields()}<Submit>{t("إنشاء", "Create")}</Submit></AdminForm></Card>
      {((data as Code[]) ?? []).map((c) => (
        <details key={c.id} className="card-admin">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <b dir="ltr">{c.code}</b>
            <span>{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? formatIQD(c.value, locale) : t("توصيل مجاني", "Free shipping")}</span>
            <Pill tone={c.is_active ? "good" : "neutral"}>{c.is_active ? t("فعال", "Active") : t("متوقف", "Off")}</Pill>
            <span className="text-xs text-mute">{t("استُخدم", "Used")} {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</span>
          </summary>
          <div className="border-t border-line p-5">
            <AdminForm action={saveDiscount} className="space-y-3">{fields(c)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
            <AdminForm action={deleteDiscount} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف (أو إيقاف إذا كان مستخدماً)", "Delete (or deactivate if used)")}</button></AdminForm>
          </div>
        </details>
      ))}
    </div>
  );
}
