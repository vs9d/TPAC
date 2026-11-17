import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { StatusTimeline } from "@/components/account/status-timeline";
import { StatusBadge } from "@/components/account/order-row";
import { ReorderButton } from "@/components/account/reorder-button";
import { formatDate, formatIQD } from "@/lib/format";
import { governorateName } from "@/lib/iraq";
import { formatIraqiPhone } from "@/lib/phone";
import type { Order, OrderItem, StatusHistory } from "@/lib/types";

export const metadata = { robots: { index: false } };

export default async function OrderDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const dict = getDictionary(locale);
  await requireUser(locale);
  const supabase = await createClient();
  // RLS guarantees this only returns the order if it belongs to the signed-in customer.
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).returns<OrderItem[]>(),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at").returns<StatusHistory[]>(),
  ]);
  const privatePaths = (items ?? []).filter((i) => i.custom_design_id && i.image_url && !i.image_url.startsWith("/")).map((i) => i.image_url!);
  const urls = await signedUrls(privatePaths);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-mute">{dict.account.orderDetails}</p>
          <h2 className="display mt-1 text-3xl" dir="ltr">{order.order_number}</h2>
          <p className="mt-1 text-sm text-mute">{dict.account.placedOn}: {formatDate(order.created_at, locale, true)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} dict={dict} />
          <ReorderButton items={(items ?? []).filter((i) => i.variant_id).map((i) => ({ variant_id: i.variant_id!, quantity: i.quantity, name_ar: i.name_ar, name_en: i.name_en, image: i.image_url, size: i.size_code ?? undefined, color_hex: i.color_hex ?? undefined }))} />
        </div>
      </div>
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="mb-4 font-semibold">{dict.account.items}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {(items ?? []).map((it) => {
              const img = it.image_url ? (it.image_url.startsWith("/") || it.image_url.startsWith("http") ? it.image_url : urls[it.image_url]) : null;
              return (
                <li key={it.id} className="flex gap-4 py-4">
                  <div className="relative h-24 w-20 shrink-0 bg-bone">{img && <Image src={img} alt="" fill sizes="80px" className="object-cover" unoptimized={img.includes("token=")} />}</div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{locale === "ar" ? it.name_ar : it.name_en}</p>
                    <p className="text-xs text-mute">{[it.size_code, locale === "ar" ? it.color_name_ar : it.color_name_en].filter(Boolean).join(" · ")} × {it.quantity}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatIQD(it.line_total, locale)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="tabular-nums">{formatIQD(order.subtotal, locale)}</dd></div>
            {order.discount_total > 0 && <div className="flex justify-between text-pine"><dt>{dict.cart.discount} {order.discount_code && `(${order.discount_code})`}</dt><dd>− {formatIQD(order.discount_total, locale)}</dd></div>}
            <div className="flex justify-between"><dt>{dict.cart.delivery}</dt><dd className="tabular-nums">{order.delivery_fee ? formatIQD(order.delivery_fee, locale) : dict.common.free}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>{dict.cart.total}</dt><dd className="tabular-nums">{formatIQD(order.total, locale)}</dd></div>
          </dl>
          <div className="mt-8 bg-bone p-5 text-sm leading-relaxed">
            <p className="font-semibold">{order.customer_name}</p>
            <p dir="ltr" className="text-start">{formatIraqiPhone(order.phone)}</p>
            <p>{governorateName(order.governorate, locale)} — {order.city}</p>
            <p>{order.address_line}</p>
            <p className="mt-2 text-mute">{dict.checkout[order.delivery_method]} · {dict.checkout.cod}</p>
          </div>
        </div>
        <div>
          <h3 className="mb-5 font-semibold">{dict.track.timeline}</h3>
          <StatusTimeline status={order.status} history={(history ?? []).map((h) => ({ status: h.to_status, at: h.created_at }))} />
        </div>
      </div>
    </div>
  );
}
