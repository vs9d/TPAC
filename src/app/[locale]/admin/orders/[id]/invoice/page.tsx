import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/content";
import { formatIQD, formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import { governorateName } from "@/lib/iraq";
import { PrintButton } from "@/components/admin/print-button";
import type { Order, OrderItem } from "@/lib/types";
import { optionsText } from "@/components/product/line-options";

export default async function Invoice({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const [{ data: items }, settings] = await Promise.all([supabase.from("order_items").select("*").eq("order_id", id).returns<OrderItem[]>(), getSettings()]);
  return (
    <div className="mx-auto max-w-3xl bg-paper p-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton label={t("طباعة", "Print")} /></div>
      <div className="flex items-start justify-between border-b-2 border-ink pb-6">
        <div>
          <Image src="/brand/tpac-logo-black.png" alt="TPAC" width={1512} height={806} className="h-12 w-auto" />
          <p className="mt-3 text-xs text-mute">{locale === "ar" ? settings.contact.address_ar : settings.contact.address_en}</p>
          {settings.contact.phone && <p className="text-xs text-mute" dir="ltr">+{settings.contact.phone}</p>}
        </div>
        <div className="text-end">
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold">{t("فاتورة", "INVOICE")}</p>
          <p className="mt-1 font-semibold" dir="ltr">{order.order_number}</p>
          <p className="text-xs text-mute">{formatDate(order.created_at, locale, true)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold text-mute">{t("إلى", "Bill to")}</p>
          <p className="font-semibold">{order.customer_name}</p>
          <p dir="ltr" className="text-start">{formatIraqiPhone(order.phone)}</p>
          <p>{governorateName(order.governorate, locale)} — {order.city}</p>
          <p>{order.address_line}</p>
          {order.delivery_notes && <p className="text-mute">{order.delivery_notes}</p>}
        </div>
        <div className="text-end">
          <p className="mb-1 text-xs font-semibold text-mute">{t("الدفع والتوصيل", "Payment & delivery")}</p>
          <p>{order.payment_method === "cod" ? dict.checkout.cod : dict.checkout.online}</p>
          <p>{dict.checkout[order.delivery_method]}</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-y border-ink text-start"><th className="py-2 text-start">{t("المنتج", "Item")}</th><th className="text-start">{t("المقاس/اللون", "Size/colour")}</th><th className="text-center">{t("الكمية", "Qty")}</th><th className="text-end">{t("السعر", "Price")}</th><th className="text-end">{t("المجموع", "Total")}</th></tr></thead>
        <tbody>
          {(items ?? []).map((it) => (
            <tr key={it.id} className="border-b border-line">
              <td className="py-2">{locale === "ar" ? it.name_ar : it.name_en}{it.sku && <span className="block text-xs text-mute" dir="ltr">{it.sku}</span>}</td>
              <td>{[it.size_code, locale === "ar" ? it.color_name_ar : it.color_name_en].filter(Boolean).join(" / ")}{it.options?.length ? <span className="block text-xs">{optionsText(it.options, locale)}</span> : null}</td>
              <td className="text-center tabular-nums">{it.quantity}</td>
              <td className="text-end tabular-nums">{formatIQD(it.unit_price, locale)}</td>
              <td className="text-end tabular-nums">{formatIQD(it.line_total, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-6 w-64 space-y-1 text-sm">
        <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="tabular-nums">{formatIQD(order.subtotal, locale)}</dd></div>
        {order.discount_total > 0 && <div className="flex justify-between"><dt>{dict.cart.discount}</dt><dd className="tabular-nums">− {formatIQD(order.discount_total, locale)}</dd></div>}
        <div className="flex justify-between"><dt>{dict.cart.delivery}</dt><dd className="tabular-nums">{formatIQD(order.delivery_fee, locale)}</dd></div>
        <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-bold"><dt>{dict.cart.total}</dt><dd className="tabular-nums">{formatIQD(order.total, locale)}</dd></div>
      </dl>
      <p className="mt-12 text-center text-xs text-mute">{t("شكراً لتسوقك من TPAC", "Thank you for shopping with TPAC")} — thetpac.com</p>
    </div>
  );
}
