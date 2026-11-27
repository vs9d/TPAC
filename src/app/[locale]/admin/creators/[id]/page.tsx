import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Select, Textarea, Submit } from "@/components/admin/form";
import { CreatorsTabs } from "@/components/admin/creators-tabs";
import { setCreatorCommission, setCreatorStatus, voidCreatorEarning } from "@/lib/actions/admin/creators";
import { creatorBalance, CREATOR_ORDER_STATUS, getCreatorSettings, type Creator } from "@/lib/creators";
import { creatorEarnings, creatorListings } from "@/lib/data/creators";
import { STATUS_LABEL } from "@/lib/creator-labels";
import { formatDate, formatIQD, cn } from "@/lib/format";

export default async function AdminCreatorDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const ar = locale === "ar";
  const { data } = await createAdminClient().from("creators").select("*").eq("user_id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Creator;
  const [b, earnings, listings, s] = await Promise.all([creatorBalance(id), creatorEarnings(id, 300), creatorListings(id), getCreatorSettings()]);
  const live = earnings.filter((e) => e.status !== "void");
  const money = (n: number) => formatIQD(n, locale);
  return (
    <div className="space-y-6">
      <PageHeader title={`${c.display_name} (@${c.username})`} subtitle={c.email ?? ""} actions={<Link href={`/${locale}/creator/${c.username}`} target="_blank" className="btn btn-outline btn-sm">{t("صفحته", "Their page")}</Link>} />
      <CreatorsTabs locale={locale} active="list" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[[t("القطع", "Pieces"), String(live.reduce((n, e) => n + e.quantity, 0))], [t("الطلبات", "Orders"), String(new Set(live.map((e) => e.order_id)).size)], [t("معلّق", "Pending"), money(b.pending + b.cleared_waiting)], [t("متاح", "Available"), money(b.available)], [t("تم دفعه", "Paid"), money(b.withdrawn)]].map(([l, v]) => (
          <div key={l} className="card-admin p-4"><p className="text-xs text-mute">{l}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t("التصاميم", "Designs")}>
            {listings.length === 0 ? <p className="text-sm text-mute">—</p> : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {listings.map((l) => { const st = STATUS_LABEL[l.status] ?? STATUS_LABEL.draft!; return (
                  <li key={l.id} className="overflow-hidden rounded-xl border border-line">
                    <div className="relative aspect-square bg-bone">{l.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt="" className="absolute inset-0 size-full object-cover" />
                    )}</div>
                    <div className="p-2 text-xs"><p className="truncate font-semibold">{l.title}</p><p className="flex justify-between"><span className={cn("rounded-full px-1.5", st[2])}>{ar ? st[0] : st[1]}</span><span>{money(l.price)}</span></p></div>
                  </li>
                ); })}
              </ul>
            )}
          </Card>
          <Card title={t("سجل الأرباح", "Earnings ledger")}>
            <div className="overflow-x-auto">
              <table className="table-admin min-w-[560px]">
                <thead><tr><th>{t("الطلب", "Order")}</th><th>{t("التصميم", "Design")}</th><th>{t("الحالة", "Status")}</th><th>{t("القاعدة", "Rule")}</th><th className="text-end">{t("الربح", "Earning")}</th><th /></tr></thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id}>
                      <td><Link className="underline" href={`/${locale}/admin/orders/${e.order_id}`}>{e.order_number}</Link><span className="block text-xs text-mute">{formatDate(e.created_at, locale)}</span></td>
                      <td>{e.product_name} <span className="text-xs text-mute">{e.size_code} × {e.quantity}</span></td>
                      <td>{e.status === "void" ? <Pill tone="neutral">{e.void_reason === "returned" ? t("مسترجع", "Returned") : t("ملغي", "Cancelled")}</Pill> : <Pill tone={e.status === "cleared" ? "good" : "warn"}>{(CREATOR_ORDER_STATUS[e.order_status ?? ""] ?? ["—", "—"])[ar ? 0 : 1]}</Pill>}</td>
                      <td className="text-xs text-mute">—</td>
                      <td className={cn("text-end font-semibold tabular-nums", e.status === "void" && "line-through opacity-50")}>{money(e.amount)}</td>
                      <td>{e.status !== "void" && <AdminForm action={voidCreatorEarning}><input type="hidden" name="id" value={e.id} /><Submit variant="outline">{t("إرجاع", "Returned")}</Submit></AdminForm>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={t("نسبة أرباحه", "Their commission")}>
            <p className="mb-3 text-xs text-mute">{t(`العامة: ${s.commission_mode === "percent" ? `${s.commission_value}% من الإضافة` : `${s.commission_value} د.ع/قطعة`}. التغيير يطبّق على المبيعات الجاية فقط.`, `Platform: ${s.commission_mode === "percent" ? `${s.commission_value}% of markup` : `${s.commission_value} IQD/piece`}. Changes apply to future sales only.`)}</p>
            <AdminForm action={setCreatorCommission} className="space-y-3">
              <input type="hidden" name="id" value={c.user_id} />
              <Select name="mode" label={t("الطريقة", "Method")} defaultValue={c.commission_mode ?? ""} options={[{ value: "", label: t("النسبة العامة", "Platform default") }, { value: "percent", label: t("نسبة % من إضافة المبدع", "% of the creator's markup") }, { value: "fixed", label: t("مبلغ ثابت لكل قطعة", "Fixed amount per piece") }]} />
              <Input name="value" type="number" min={0} label={t("القيمة (% أو د.ع)", "Value (% or IQD)")} defaultValue={c.commission_value ?? ""} />
              <Submit>{t("حفظ", "Save")}</Submit>
            </AdminForm>
          </Card>
          <Card title={t("الحساب", "Account")}>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-mute">{t("الهاتف", "Phone")}</dt><dd dir="ltr">{c.phone}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{t("انضم", "Joined")}</dt><dd>{formatDate(c.created_at, locale)}</dd></div>
              {Object.entries(c.socials ?? {}).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-mute">{k}</dt><dd className="truncate"><a className="underline" href={v} target="_blank" rel="noopener noreferrer nofollow">{v}</a></dd></div>)}
            </dl>
            <AdminForm action={setCreatorStatus} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={c.user_id} />
              <Select name="status" label={t("الحالة", "Status")} defaultValue={c.status === "pending" ? "approved" : c.status} options={[{ value: "approved", label: t("مفعّل", "Active") }, { value: "suspended", label: t("موقوف", "Suspended") }, { value: "rejected", label: t("مرفوض", "Rejected") }]} />
              <Textarea name="note" label={t("ملاحظة للمبدع", "Note to the creator")} defaultValue={c.review_note ?? ""} />
              <Submit variant="outline">{t("تحديث", "Update")}</Submit>
            </AdminForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
