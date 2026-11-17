import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MessageCircle } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Card, Pill, BULK_TONE } from "@/components/admin/ui";
import { AdminForm, Select, Textarea, Submit } from "@/components/admin/form";
import { QuotationEditor, type QuotationData } from "@/components/admin/quotation-editor";
import { updateBulkRequest, convertQuotation } from "@/lib/actions/admin/bulk";
import { formatDate, formatIQD, formatNumber } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";

export default async function AdminBulkDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: r } = await supabase.from("bulk_order_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const [{ data: art }, { data: quotes }] = await Promise.all([
    supabase.from("uploaded_artwork").select("*").eq("bulk_request_id", id),
    supabase.from("quotations").select("*").eq("bulk_request_id", id).order("created_at", { ascending: false }),
  ]);
  const urls = await signedUrls((art ?? []).map((a) => a.storage_path));
  const { data: unit } = await supabase.rpc("bulk_unit_price", { p_product_type: r.product_type, p_quantity: r.estimated_quantity });
  const sizes = Object.entries((r.size_breakdown ?? {}) as Record<string, number>);
  const suggested = (sizes.length ? sizes.map(([size, q]) => ({ size, quantity: q })) : [{ size: "", quantity: r.estimated_quantity }]).map((x) => ({
    description: `${dict.bulk.productTypes[r.product_type] ?? r.product_type} — ${r.organization_name}`,
    size: x.size || undefined,
    quantity: x.quantity,
    unit_price: (unit as number | null) ?? 0,
  }));
  const wa = `https://wa.me/${r.phone}?text=${encodeURIComponent(`مرحباً ${r.contact_name}، بخصوص طلبكم ${r.request_number} من TPAC`)}`;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${r.request_number} — ${r.organization_name}`}
        subtitle={formatDate(r.created_at, locale, true)}
        actions={<><Pill tone={BULK_TONE[r.status]}>{r.status}</Pill><a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><MessageCircle className="size-4" /> WhatsApp</a><a href={`tel:+${r.phone}`} className="btn btn-outline btn-sm">{t("اتصال", "Call")}</a></>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t("تفاصيل الطلب", "Request details")}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-mute">{dict.bulk.contactName}</dt><dd className="font-semibold">{r.contact_name}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.phone}</dt><dd dir="ltr" className="text-start font-semibold">{formatIraqiPhone(r.phone)}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.email}</dt><dd>{r.email ?? "—"}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.productType}</dt><dd>{dict.bulk.productTypes[r.product_type]}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.estimatedQuantity}</dt><dd className="font-semibold">{formatNumber(r.estimated_quantity, locale)}</dd></div>
              <div><dt className="text-xs text-mute">{t("السعر المقترح للقطعة (حسب القواعد)", "Suggested unit price (rules)")}</dt><dd>{unit ? formatIQD(unit as number, locale) : "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-mute">{dict.bulk.sizes}</dt><dd className="flex flex-wrap gap-2">{sizes.length ? sizes.map(([s, q]) => <Pill key={s}>{s}: {q}</Pill>) : "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-mute">{dict.bulk.printing}</dt><dd className="whitespace-pre-line">{r.printing_requirements ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-mute">{dict.bulk.notes}</dt><dd className="whitespace-pre-line">{r.notes ?? "—"}</dd></div>
            </dl>
            {!!art?.length && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold text-mute">{dict.bulk.artwork}</p>
                {art.map((a) => <a key={a.id} href={urls[a.storage_path]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border border-line px-3 py-2 text-sm hover:border-ink"><span>{a.original_name ?? a.storage_path} <span className="text-xs text-mute">({a.mime_type})</span></span><Download className="size-4" /></a>)}
              </div>
            )}
          </Card>
          {(quotes ?? []).map((q) => (
            <Card key={q.id} title={`${t("عرض السعر", "Quotation")} ${q.quote_number}`} actions={<Pill tone={q.status === "approved" ? "good" : q.status === "converted" ? "dark" : "neutral"}>{q.status}</Pill>}>
              <QuotationEditor requestId={id} quotation={q as QuotationData} suggested={suggested} />
              {q.status === "approved" && (
                <AdminForm action={convertQuotation} className="mt-4 border-t border-line pt-4" redirectTo={(orderId) => `/${locale}/admin/orders/${orderId}`}>
                  <input type="hidden" name="id" value={q.id} />
                  <Submit variant="accent">{t("تحويل إلى طلب", "Convert to order")}</Submit>
                </AdminForm>
              )}
              {q.order_id && <Link href={`/${locale}/admin/orders/${q.order_id}`} className="mt-3 inline-block text-sm underline">{t("عرض الطلب الناتج", "View resulting order")}</Link>}
            </Card>
          ))}
          <Card title={t("عرض سعر جديد", "New quotation")}><QuotationEditor requestId={id} suggested={suggested} /></Card>
        </div>
        <Card title={t("المتابعة", "Follow-up")}>
          <AdminForm action={updateBulkRequest} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <Select name="status" label={t("الحالة", "Status")} defaultValue={r.status === "converted" ? "approved" : r.status} options={["new", "contacted", "quoted", "approved", "rejected"].map((s) => ({ value: s, label: s }))} />
            <Textarea name="admin_notes" label={t("ملاحظات داخلية", "Internal notes")} defaultValue={r.admin_notes ?? ""} rows={5} />
            <Submit>{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
      </div>
    </div>
  );
}
