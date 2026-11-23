import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Select, Checkbox, Submit } from "@/components/admin/form";
import { saveDiscount, deleteDiscount } from "@/lib/actions/admin/marketing";
import { formatDate, formatIQD, toBaghdadInput } from "@/lib/format";

type Code = { id: string; code: string; description: string | null; type: string; value: number; min_order_total: number; max_discount: number | null; max_uses: number | null; max_uses_per_customer: number | null; used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean };

export default async function AdminDiscounts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data }, { data: usageRows }] = await Promise.all([
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("discount_usage").select("discount_code_id, amount, phone, user_id, created_at, order:orders(id, order_number, customer_name, phone, total, status)").order("created_at", { ascending: false }).limit(2000),
  ]);
  type Use = { discount_code_id: string; amount: number; phone: string | null; user_id: string | null; created_at: string; order: { id: string; order_number: string; customer_name: string; phone: string; total: number; status: string } | null };
  const usage = (usageRows as unknown as Use[]) ?? [];
  const statsOf = (id: string) => {
    const rows = usage.filter((u) => u.discount_code_id === id);
    const live = rows.filter((u) => u.order?.status !== "cancelled");
    return {
      rows,
      uses: live.length,
      customers: new Set(live.map((u) => u.user_id ?? u.phone ?? u.order?.phone)).size,
      discount: live.reduce((n, u) => n + u.amount, 0),
      revenue: live.reduce((n, u) => n + (u.order?.total ?? 0), 0),
    };
  };
  const now = Date.now();
  const state = (c: Code) =>
    !c.is_active ? ["neutral", t("متوقف", "Off")] as const
    : c.ends_at && new Date(c.ends_at).getTime() < now ? ["bad", t("منتهي", "Expired")] as const
    : c.starts_at && new Date(c.starts_at).getTime() > now ? ["warn", t("مجدول", "Scheduled")] as const
    : c.max_uses && c.used_count >= c.max_uses ? ["bad", t("مستنفد", "Used up")] as const
    : ["good", t("فعال", "Active")] as const;
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
      {(() => {
        const live = usage.filter((u) => u.order?.status !== "cancelled");
        const codes = (data as Code[]) ?? [];
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([[t("أكواد فعالة", "Active codes"), String(codes.filter((c) => state(c)[0] === "good").length)], [t("مرات الاستخدام", "Total uses"), String(live.length)], [t("مجموع الخصم", "Discount given"), formatIQD(live.reduce((n, u) => n + u.amount, 0), locale)], [t("مبيعات بالأكواد", "Sales with codes"), formatIQD(live.reduce((n, u) => n + (u.order?.total ?? 0), 0), locale)]] as const).map(([k, v]) => (
              <div key={k} className="card-admin p-4"><p className="text-xs text-mute">{k}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
            ))}
          </div>
        );
      })()}
      <Card title={t("كود جديد", "New code")}><AdminForm action={saveDiscount} resetOnSuccess className="space-y-3">{fields()}<Submit>{t("إنشاء", "Create")}</Submit></AdminForm></Card>
      {((data as Code[]) ?? []).map((c) => (
        <details key={c.id} className="card-admin">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <b dir="ltr">{c.code}</b>
            <span>{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? formatIQD(c.value, locale) : t("توصيل مجاني", "Free shipping")}</span>
            <Pill tone={state(c)[0]}>{state(c)[1]}</Pill>
            <span className="text-xs text-mute">{t("استُخدم", "Used")} {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</span>
          </summary>
          <div className="space-y-5 border-t border-line p-5">
            {(() => {
              const st = statsOf(c.id);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([[t("مرات الاستخدام", "Uses"), String(st.uses)], [t("زبائن", "Customers"), String(st.customers)], [t("مجموع الخصم", "Total discount"), formatIQD(st.discount, locale)], [t("مبيعات بالكود", "Sales with code"), formatIQD(st.revenue, locale)]] as const).map(([k, v]) => (
                      <div key={k} className="rounded-2xl bg-bone p-3"><p className="text-xs text-mute">{k}</p><p className="mt-1 font-bold tabular-nums">{v}</p></div>
                    ))}
                  </div>
                  {st.rows.length ? (
                    <div className="overflow-x-auto rounded-2xl border border-line">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-bone text-xs text-mute"><th className="p-2 text-start">{t("الزبون", "Customer")}</th><th className="p-2 text-start">{t("الطلب", "Order")}</th><th className="p-2 text-start">{t("الخصم", "Discount")}</th><th className="p-2 text-start">{t("التاريخ", "Date")}</th></tr></thead>
                        <tbody>
                          {st.rows.slice(0, 100).map((u, i) => (
                            <tr key={i} className="border-t border-line">
                              <td className="p-2"><span className="font-semibold">{u.order?.customer_name ?? "—"}</span> <span className="text-xs text-mute" dir="ltr">{u.order?.phone ?? u.phone}</span></td>
                              <td className="p-2">{u.order ? <a href={`/${locale}/admin/orders/${u.order.id}`} className="font-semibold text-pine underline" dir="ltr">{u.order.order_number}</a> : "—"}{u.order?.status === "cancelled" && <span className="ms-1 text-xs text-danger">({t("ملغي", "cancelled")})</span>}</td>
                              <td className="p-2 tabular-nums">{formatIQD(u.amount, locale)}</td>
                              <td className="p-2 text-xs text-mute">{formatDate(u.created_at, locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-mute">{t("محد استخدم هذا الكود بعد.", "Nobody has used this code yet.")}</p>}
                </div>
              );
            })()}
            <AdminForm action={saveDiscount} className="space-y-3">{fields(c)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
            <AdminForm action={deleteDiscount} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف (أو إيقاف إذا كان مستخدماً)", "Delete (or deactivate if used)")}</button></AdminForm>
          </div>
        </details>
      ))}
    </div>
  );
}
