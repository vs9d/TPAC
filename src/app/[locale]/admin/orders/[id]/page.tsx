import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, MessageCircle, Download } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Card, Pill, STATUS_TONE } from "@/components/admin/ui";
import { AdminForm, Select, Textarea, Input, Submit } from "@/components/admin/form";
import { updateOrderStatus, addOrderNote, updateOrderDetails } from "@/lib/actions/admin/orders";
import { nextStatuses } from "@/lib/order-status";
import { groupDesigns, optionNames, optionList, previewPaths, type DesignRow } from "@/lib/design-admin";
import { formatIQD, formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import { governorateName } from "@/lib/iraq";
import type { Order, OrderItem, StatusHistory } from "@/lib/types";

interface Design { id: string; batch_id: string | null; name: string | null; options: { method?: string; finish?: string; fabric?: string; package?: string; addons?: string[] } | null; garment_type: string; size_code: string; print_locations: string[]; preview_front_path: string | null; preview_back_path: string | null; notes: string | null; config: { objects?: { type: string; location: string; text?: string; fontFamily?: string; fill?: string; artwork_id?: string }[] } }
interface Artwork { id: string; storage_path: string; mime_type: string; original_name: string | null; width: number | null; height: number | null; custom_design_id: string | null }

export default async function AdminOrderDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const [{ data: items }, { data: history }, { data: notes }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).returns<OrderItem[]>(),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at").returns<StatusHistory[]>(),
    supabase.from("order_notes").select("id, body, created_at, author_id").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id).filter(Boolean))];
  const { data: authors } = authorIds.length ? await supabase.from("customer_profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name as string | null]));
  const designIds = (items ?? []).map((i) => i.custom_design_id).filter(Boolean) as string[];
  let designs: Design[] = [];
  let artwork: Artwork[] = [];
  if (designIds.length) {
    const [d, a] = await Promise.all([
      supabase.from("custom_designs").select("*").in("id", designIds),
      Promise.resolve(null),
    ]);
    void a;
    designs = (d.data as Design[]) ?? [];
    // original files are referenced from the saved layout (one batch = one set of files for every size)
    const artIds = [...new Set(designs.flatMap((x) => (x.config.objects ?? []).map((o) => o.artwork_id).filter(Boolean) as string[]))];
    if (artIds.length) artwork = ((await supabase.from("uploaded_artwork").select("*").in("id", artIds)).data as Artwork[]) ?? [];
  }
  const optNames = await optionNames(supabase);
  // one card per saved design (its sizes are separate rows sharing a batch)
  const designGroups = groupDesigns(designs as unknown as DesignRow[]);
  const urls = await signedUrls([
    ...designs.flatMap((d) => previewPaths(d as unknown as DesignRow).map((p) => p.path)),
    ...artwork.map((a) => a.storage_path),
  ]);
  const allowed = nextStatuses(order.status);
  const wa = `https://wa.me/${order.phone}?text=${encodeURIComponent(`${locale === "ar" ? "مرحباً" : "Hello"} ${order.customer_name} — TPAC ${order.order_number}`)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("الطلب", "Order")} ${order.order_number}`}
        subtitle={formatDate(order.created_at, locale, true)}
        actions={<>
          <Pill tone={STATUS_TONE[order.status]}>{dict.status[order.status]}</Pill>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><MessageCircle className="size-4" /> WhatsApp</a>
          <Link href={`/${locale}/admin/orders/${id}/invoice`} target="_blank" className="btn btn-outline btn-sm"><Printer className="size-4" /> {t("الفاتورة", "Invoice")}</Link>
          {designs.length > 0 && <Link href={`/${locale}/admin/orders/${id}/production`} target="_blank" className="btn btn-brand btn-sm"><Printer className="size-4" /> {t("ورقة التصنيع", "Production sheet")}</Link>}
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={t("المنتجات", "Items")}>
            <table className="table-admin">
              <tbody>
                {(items ?? []).map((it) => {
                  const design = designs.find((d) => d.id === it.custom_design_id);
                  const img = it.image_url ? (it.image_url.startsWith("/") || it.image_url.startsWith("http") ? it.image_url : urls[it.image_url]) : null;
                  return (
                    <tr key={it.id}>
                      <td className="w-16"><div className="relative h-16 w-14 bg-bone">{img && <Image src={img} alt="" fill sizes="56px" className="object-cover" unoptimized={img.includes("token=")} />}</div></td>
                      <td>
                        <p className="font-semibold">{locale === "ar" ? it.name_ar : it.name_en}</p>
                        <p className="text-xs text-mute">{[it.sku, it.size_code, locale === "ar" ? it.color_name_ar : it.color_name_en].filter(Boolean).join(" · ")}</p>
                        {design && <Pill tone="warn">{t("تصميم خاص", "Custom design")}</Pill>}
                      </td>
                      <td className="tabular-nums">{formatIQD(it.unit_price, locale)} × {it.quantity}</td>
                      <td className="text-end font-semibold tabular-nums">{formatIQD(it.line_total, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <dl className="ms-auto mt-4 max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="tabular-nums">{formatIQD(order.subtotal, locale)}</dd></div>
              {order.discount_total > 0 && <div className="flex justify-between text-pine"><dt>{dict.cart.discount} {order.discount_code}</dt><dd>− {formatIQD(order.discount_total, locale)}</dd></div>}
              <div className="flex justify-between"><dt>{dict.cart.delivery} ({dict.checkout[order.delivery_method]})</dt><dd className="tabular-nums">{formatIQD(order.delivery_fee, locale)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-bold"><dt>{dict.cart.total}</dt><dd className="tabular-nums">{formatIQD(order.total, locale)}</dd></div>
            </dl>
          </Card>

          {designGroups.map((grp) => { const d = grp.primary as unknown as Design; return (
            <Card key={grp.key} title={`${t("التصميم الخاص", "Custom design")}${d.name ? ` «${d.name}»` : ""} — ${d.garment_type} · ${grp.rows.map((r) => `${r.size_code}×${items?.find((i) => i.custom_design_id === r.id)?.quantity ?? 0}`).join("  ")}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                {previewPaths(d as unknown as DesignRow).map(({ key, path: p }) => urls[p] && (
                  <a key={p} href={urls[p]} target="_blank" rel="noopener noreferrer" className="relative block aspect-[6/7] bg-bone">
                    <Image src={urls[p]!} alt={key} fill sizes="300px" className="object-contain" unoptimized />
                  </a>
                ))}
              </div>
              <p className="mt-4 text-sm"><span className="font-semibold">{t("أماكن الطباعة", "Placements")}:</span> {d.print_locations.map((l) => dict.designer.locations[l] ?? l).join("، ")}</p>
              {optionList(d, optNames, locale).length > 0 && <p className="mt-1 text-sm"><span className="font-semibold">{t("خيارات الطباعة", "Print options")}:</span> {optionList(d, optNames, locale).join(" · ")}</p>}
              {d.notes && <p className="mt-1 text-sm"><span className="font-semibold">{t("ملاحظات العميل", "Customer notes")}:</span> {d.notes}</p>}
              <ul className="mt-3 space-y-1 text-sm">
                {(d.config.objects ?? []).filter((o) => o.type === "text").map((o, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="size-3 rounded-full border" style={{ background: o.fill }} /> «{o.text}» — {o.fontFamily} — {dict.designer.locations[o.location]}</li>
                ))}
              </ul>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-mute">{t("الملفات الأصلية (للطباعة)", "Original files (for print)")}</p>
                {artwork.filter((a) => (d.config.objects ?? []).some((o) => o.artwork_id === a.id)).map((a) => (
                  <a key={a.id} href={urls[a.storage_path]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border border-line px-3 py-2 text-sm hover:border-ink">
                    <span className="truncate">{a.original_name ?? a.storage_path.split("/").pop()} <span className="text-xs text-mute">({a.mime_type}{a.width ? ` · ${a.width}×${a.height}px` : ""})</span></span>
                    <Download className="size-4" />
                  </a>
                ))}
              </div>
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-mute">{t("بيانات التموضع (JSON)", "Placement data (JSON)")}</summary>
                <pre className="mt-2 max-h-64 overflow-auto bg-bone p-3" dir="ltr">{JSON.stringify(d.config, null, 2)}</pre>
              </details>
            </Card>
          ); })}

          <Card title={t("سجل الحالات", "Status history")}>
            <ol className="space-y-3 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-mute tabular-nums">{formatDate(h.created_at, locale, true)}</span>
                  {h.from_status && <><Pill>{dict.status[h.from_status]}</Pill>→</>}
                  <Pill tone={STATUS_TONE[h.to_status]}>{dict.status[h.to_status]}</Pill>
                  {h.note && <span className="text-mute">— {h.note}</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t("تحديث الحالة", "Update status")}>
            {allowed.length ? (
              <AdminForm action={updateOrderStatus} className="space-y-3" resetOnSuccess>
                <input type="hidden" name="order_id" value={order.id} />
                <Select name="status" label={t("الحالة الجديدة", "New status")} options={allowed.map((s) => ({ value: s, label: dict.status[s]! }))} />
                <Textarea name="note" label={t("ملاحظة (اختياري)", "Note (optional)")} rows={2} />
                <p className="text-xs text-mute">{t("الإلغاء قبل الشحن يعيد الكميات للمخزون تلقائياً.", "Cancelling before shipping restores stock automatically.")}</p>
                <Submit>{t("تحديث", "Update")}</Submit>
              </AdminForm>
            ) : <p className="text-sm text-mute">{t("الطلب في حالة نهائية.", "This order is in a final state.")}</p>}
          </Card>

          <Card title={t("العميل والتوصيل", "Customer & delivery")}>
            <div className="mb-4 space-y-1 text-sm">
              <p className="font-semibold">{order.customer_name}</p>
              <p dir="ltr" className="text-start">{formatIraqiPhone(order.phone)}</p>
              {order.email && <p>{order.email}</p>}
              <p>{governorateName(order.governorate, locale)}</p>
              {order.user_id ? <Link href={`/${locale}/admin/customers/${order.user_id}`} className="text-xs underline">{t("ملف العميل", "Customer profile")}</Link> : <Pill>{t("زائر", "Guest")}</Pill>}
            </div>
            <AdminForm action={updateOrderDetails} className="space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <Input name="city" label={t("المدينة", "City")} defaultValue={order.city} />
              <Textarea name="address_line" label={t("العنوان", "Address")} defaultValue={order.address_line} rows={2} />
              <Input name="delivery_notes" label={t("ملاحظات التوصيل", "Delivery notes")} defaultValue={order.delivery_notes ?? ""} />
              <Select name="payment_status" label={t("حالة الدفع", "Payment status")} defaultValue={order.payment_status} options={["unpaid", "pending", "paid", "refunded", "failed"].map((v) => ({ value: v, label: v }))} />
              <Submit variant="outline">{t("حفظ", "Save")}</Submit>
            </AdminForm>
          </Card>

          <Card title={t("ملاحظات داخلية", "Internal notes")}>
            <AdminForm action={addOrderNote} className="space-y-2" resetOnSuccess>
              <input type="hidden" name="order_id" value={order.id} />
              <Textarea name="body" label={t("ملاحظة جديدة", "New note")} rows={2} required />
              <Submit variant="outline">{t("إضافة", "Add")}</Submit>
            </AdminForm>
            <ul className="mt-4 space-y-3 text-sm">
              {(notes ?? []).map((n) => (
                <li key={n.id} className="border-s-2 border-amber ps-3">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-mute">{authorName.get(n.author_id) ?? "—"} · {formatDate(n.created_at, locale, true)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
