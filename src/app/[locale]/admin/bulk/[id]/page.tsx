import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MessageCircle } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Card, Pill, BULK_TONE } from "@/components/admin/ui";
import { AdminForm, Input, Select, Textarea, Submit } from "@/components/admin/form";
import { QuotationEditor, type QuotationData } from "@/components/admin/quotation-editor";
import { updateBulkRequest, convertQuotation, convertRequestToOrder } from "@/lib/actions/admin/bulk";
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
  // a group order: every member's own piece as they designed it (staff read it with the service key: no public policy)
  type Member = { id: string; name: string; size_code: string; quantity: number; print_name: string | null; preview_front_path: string | null; preview_back_path: string | null };
  const { data: members } = r.group_order_id
    ? await createAdminClient().from("group_order_members").select("id, name, size_code, quantity, print_name, preview_front_path, preview_back_path").eq("group_id", r.group_order_id).order("created_at")
    : { data: [] };
  const people = (members ?? []) as Member[];
  const urls = await signedUrls([...(art ?? []).map((a) => a.storage_path), ...people.flatMap((m) => [m.preview_front_path, m.preview_back_path].filter((x): x is string => !!x))]);
  const { data: unit } = await supabase.rpc("bulk_unit_price", { p_product_type: r.product_type, p_quantity: r.estimated_quantity });
  const sizes = Object.entries((r.size_breakdown ?? {}) as Record<string, number>);
  const suggested = (sizes.length ? sizes.map(([size, q]) => ({ size, quantity: q })) : [{ size: "", quantity: r.estimated_quantity }]).map((x) => ({
    description: `${dict.bulk.productTypes[r.product_type] ?? r.product_type} — ${r.organization_name}`,
    size: x.size || undefined,
    quantity: x.quantity,
    unit_price: (unit as number | null) ?? 0,
  }));
  const label: Record<string, string> = { new: t("طلب جديد", "New request"), contacted: t("قيد المراجعة", "Under review"), quoted: t("تم إرسال العرض", "Quotation sent"), approved: t("موافق عليه", "Approved"), rejected: t("مرفوض", "Rejected"), converted: t("تحوّل لطلب", "Converted") };
  const qty = (r.quoted_quantity ?? r.quantity_max ?? r.estimated_quantity) as number;
  const quotedTotal = r.quoted_unit_price != null ? r.quoted_unit_price * qty : null;
  const waText = quotedTotal != null
    ? `مرحباً ${r.contact_name} ❤️\nبخصوص طلب عرض السعر ${r.request_number} من TPAC:\n${dict.bulk.productTypes[r.product_type] ?? r.product_type} — ${formatNumber(qty, "ar")} قطعة\nسعر القطعة: ${formatIQD(r.quoted_unit_price, "ar")}\nالمجموع: ${formatIQD(quotedTotal, "ar")}`
    : `مرحباً ${r.contact_name}، بخصوص طلب عرض السعر ${r.request_number} من TPAC`;
  const wa = `https://wa.me/${r.phone}?text=${encodeURIComponent(waText)}`;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${r.request_number} — ${r.organization_name}`}
        subtitle={formatDate(r.created_at, locale, true)}
        actions={<><Pill tone={BULK_TONE[r.status]}>{label[r.status] ?? r.status}</Pill><a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><MessageCircle className="size-4" /> WhatsApp</a><a href={`tel:+${r.phone}`} className="btn btn-outline btn-sm">{t("اتصال", "Call")}</a></>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t("تفاصيل الطلب", "Request details")}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-mute">{dict.bulk.contactName}</dt><dd className="font-semibold">{r.contact_name}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.phone}</dt><dd dir="ltr" className="text-start font-semibold">{formatIraqiPhone(r.phone)}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.email}</dt><dd>{r.email ?? "—"}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.productType}</dt><dd>{dict.bulk.productTypes[r.product_type]}</dd></div>
              <div><dt className="text-xs text-mute">{t("الكمية المتوقعة", "Expected quantity")}</dt><dd className="font-semibold tabular-nums">{r.quantity_min ? `${formatNumber(r.quantity_min, locale)} – ${formatNumber(r.quantity_max ?? r.quantity_min, locale)}` : formatNumber(r.estimated_quantity, locale)}</dd></div>
              <div><dt className="text-xs text-mute">{dict.bulk.preferredColor}</dt><dd className="font-semibold">{r.preferred_color ?? "—"}</dd></div>
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
          {people.length > 0 && (
            <Card title={t(`قطع الأشخاص (${people.length})`, `Each person's piece (${people.length})`)}>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {people.map((m) => (
                  <li key={m.id} className="rounded-2xl border border-line p-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {[m.preview_front_path, m.preview_back_path].map((p, k) => p && urls[p] ? (
                        <a key={k} href={urls[p]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-bone">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urls[p]} alt={`${m.name} — ${k === 0 ? t("الأمام", "front") : t("الخلف", "back")}`} className="aspect-[6/7] w-full object-contain" />
                        </a>
                      ) : <div key={k} className="aspect-[6/7] rounded-xl bg-bone" />)}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{m.name} · {m.size_code}{m.quantity > 1 ? ` × ${m.quantity}` : ""}</p>
                    {m.print_name && <p className="text-xs text-mute" dir="auto">«{m.print_name}»</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(quotes ?? []).map((q) => (
            <Card key={q.id} title={`${t("عرض السعر", "Quotation")} ${q.quote_number}`} actions={<Pill tone={q.status === "approved" ? "good" : q.status === "converted" ? "dark" : "neutral"}>{q.status}</Pill>}>
              <QuotationEditor requestId={id} quotation={q as QuotationData} suggested={suggested} />
              {q.status === "approved" && (
                <AdminForm action={convertQuotation} className="mt-4 border-t border-line pt-4">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="locale" value={locale} />
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
            <Select name="status" label={t("الحالة", "Status")} defaultValue={r.status === "converted" ? "approved" : r.status} options={["new", "contacted", "quoted", "approved", "rejected"].map((s) => ({ value: s, label: label[s]! }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input name="quoted_unit_price" type="number" min={0} step={250} inputMode="numeric" label={t("سعر القطعة (د.ع)", "Price per piece (IQD)")} defaultValue={r.quoted_unit_price ?? ""} />
              <Input name="quoted_quantity" type="number" min={1} inputMode="numeric" label={t("الكمية", "Quantity")} defaultValue={r.quoted_quantity ?? r.quantity_max ?? r.estimated_quantity} />
            </div>
            {quotedTotal != null && <p className="rounded-xl bg-bone p-3 text-sm">{t("المجموع:", "Total:")} <b className="tabular-nums">{formatIQD(quotedTotal, locale)}</b></p>}
            <Textarea name="admin_notes" label={t("ملاحظات داخلية", "Internal notes")} defaultValue={r.admin_notes ?? ""} rows={5} />
            <Submit>{t("حفظ", "Save")}</Submit>
          </AdminForm>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-4 w-full"><MessageCircle className="size-4" /> {quotedTotal != null ? t("أرسل العرض على الواتساب", "Send the quote on WhatsApp") : t("راسل على الواتساب", "Message on WhatsApp")}</a>
          {r.status === "approved" && quotedTotal != null && (
            <AdminForm action={convertRequestToOrder} className="mt-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="locale" value={locale} />
              <Submit variant="accent" className="w-full">{t("تحويل إلى طلب", "Convert to order")}</Submit>
            </AdminForm>
          )}
          {r.status === "approved" && quotedTotal == null && <p className="mt-3 text-xs text-mute">{t("سجّل سعر القطعة حتى تگدر تحوّله لطلب.", "Enter the price per piece to convert it into an order.")}</p>}
        </Card>
      </div>
    </div>
  );
}
