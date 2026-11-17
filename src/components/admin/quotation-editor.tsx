"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { formatIQD } from "@/lib/format";
import { AdminForm, Input, Select, Textarea, Submit } from "./form";
import { saveQuotation } from "@/lib/actions/admin/bulk";

interface Item { description: string; size?: string; quantity: number; unit_price: number }
export interface QuotationData { id?: string; items: Item[]; discount: number; delivery_fee: number; valid_until: string | null; notes: string | null; status: string }

export function QuotationEditor({ requestId, quotation, suggested }: { requestId: string; quotation?: QuotationData; suggested: Item[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [items, setItems] = useState<Item[]>(quotation?.items.length ? quotation.items : suggested);
  const [discount, setDiscount] = useState(quotation?.discount ?? 0);
  const [delivery, setDelivery] = useState(quotation?.delivery_fee ?? 0);
  const subtotal = items.reduce((n, it) => n + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - discount) + delivery;
  const set = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const locked = quotation?.status === "converted";
  return (
    <AdminForm action={saveQuotation} className="space-y-4">
      {quotation?.id && <input type="hidden" name="id" value={quotation.id} />}
      <input type="hidden" name="bulk_request_id" value={requestId} />
      <div className="overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>{t("الوصف", "Description")}</th><th>{t("المقاس", "Size")}</th><th>{t("الكمية", "Qty")}</th><th>{t("سعر القطعة", "Unit price")}</th><th className="text-end">{t("المجموع", "Total")}</th><th></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><input name="item_description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} className="field h-9 px-2 text-sm" required /></td>
                <td><input name="item_size" value={it.size ?? ""} onChange={(e) => set(i, { size: e.target.value })} className="field h-9 w-20 px-2 text-sm" /></td>
                <td><input name="item_quantity" type="number" min={1} value={it.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} className="field h-9 w-24 px-2 text-sm" /></td>
                <td><input name="item_unit_price" type="number" min={0} step={250} value={it.unit_price} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} className="field h-9 w-32 px-2 text-sm" /></td>
                <td className="text-end tabular-nums">{formatIQD(it.quantity * it.unit_price, locale)}</td>
                <td><button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={t("حذف", "Remove")}><Trash2 className="size-4 text-danger" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 1, unit_price: 0 }])} className="btn btn-outline btn-sm"><Plus className="size-4" /> {t("بند جديد", "Add line")}</button>
      <div className="grid gap-3 sm:grid-cols-4">
        <Input name="discount" type="number" min={0} label={t("خصم", "Discount")} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
        <Input name="delivery_fee" type="number" min={0} label={t("التوصيل", "Delivery")} value={delivery} onChange={(e) => setDelivery(Number(e.target.value) || 0)} />
        <Input name="valid_until" type="date" label={t("صالح حتى", "Valid until")} defaultValue={quotation?.valid_until ?? ""} />
        <Select name="status" label={t("الحالة", "Status")} defaultValue={quotation?.status === "converted" ? "approved" : quotation?.status ?? "draft"} options={[{ value: "draft", label: t("مسودة", "Draft") }, { value: "sent", label: t("مُرسل للعميل", "Sent") }, { value: "approved", label: t("وافق العميل", "Approved") }, { value: "rejected", label: t("مرفوض", "Rejected") }, { value: "expired", label: t("منتهي", "Expired") }]} />
      </div>
      <Textarea name="notes" label={t("ملاحظات العرض", "Quote notes")} defaultValue={quotation?.notes ?? ""} rows={2} />
      <div className="flex items-center justify-between border-t border-line pt-3">
        <p className="text-sm">{t("المجموع الفرعي", "Subtotal")}: <b className="tabular-nums">{formatIQD(subtotal, locale)}</b> — {t("الإجمالي", "Total")}: <b className="tabular-nums">{formatIQD(total, locale)}</b></p>
        {!locked && <Submit>{t("حفظ عرض السعر", "Save quotation")}</Submit>}
      </div>
    </AdminForm>
  );
}
