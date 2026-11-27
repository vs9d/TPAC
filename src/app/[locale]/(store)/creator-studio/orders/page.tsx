import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator, CREATOR_ORDER_STATUS } from "@/lib/creators";
import { creatorEarnings } from "@/lib/data/creators";
import { formatDate, formatIQD, cn } from "@/lib/format";

/** Orders with the creator's designs — order number, design, size, status and earning. Never the customer. */
export default async function CreatorOrders({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const rows = await creatorEarnings(me.user_id);
  const label = (r: (typeof rows)[number]) => {
    if (r.status === "void") return r.void_reason === "returned" ? [ar ? "مسترجع" : "Returned", "bg-danger/10 text-danger"] : [ar ? "ملغي" : "Cancelled", "bg-danger/10 text-danger"];
    const s = CREATOR_ORDER_STATUS[r.order_status ?? ""] ?? ["—", "—"];
    return [ar ? s[0] : s[1], r.order_status === "delivered" ? "bg-pine-soft text-pine" : "bg-bone"];
  };
  const earningNote = (r: (typeof rows)[number]) => r.status === "void" ? (ar ? "انشال" : "removed") : r.status === "pending" ? (ar ? "معلّق" : "pending") : r.available_at && new Date(r.available_at) > new Date() ? (ar ? `قابل للسحب ${formatDate(r.available_at, locale)}` : `withdrawable ${formatDate(r.available_at, locale)}`) : (ar ? "متاح" : "available");
  return (
    <section className="space-y-4">
      <h2 className="display text-2xl">{ar ? "طلباتي" : "My orders"}</h2>
      <p className="text-sm text-mute">{ar ? "الطلبات اللي بيها تصاميمك. بيانات الزبائن ما تظهر هنا — TPAC يتكفل بالتجهيز والتوصيل وخدمة الزبون." : "Orders with your designs. Customer details stay with TPAC, who handle packing, delivery and support."}</p>
      {rows.length === 0 ? <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "بعد ماكو طلبات. شارك رابط صفحتك ورابط تصاميمك 🚀" : "No orders yet. Share your page and designs 🚀"}</p> : (
        <div className="overflow-x-auto rounded-[1.5rem] border border-line bg-paper">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-xs text-mute"><th className="p-3 text-start">{ar ? "الطلب" : "Order"}</th><th className="p-3 text-start">{ar ? "التصميم" : "Design"}</th><th className="p-3 text-start">{ar ? "التاريخ" : "Date"}</th><th className="p-3 text-start">{ar ? "الحالة" : "Status"}</th><th className="p-3 text-end">{ar ? "ربحك" : "Earning"}</th></tr></thead>
            <tbody>
              {rows.map((r) => { const [l, cls] = label(r); return (
                <tr key={r.id} className="border-b border-line/60">
                  <td className="p-3 font-semibold tabular-nums" dir="ltr">{r.order_number}</td>
                  <td className="p-3">{r.product_name}<span className="block text-xs text-mute">{r.size_code ?? ""} × {r.quantity}</span></td>
                  <td className="p-3 text-mute">{formatDate(r.created_at, locale)}</td>
                  <td className="p-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", cls)}>{l}</span></td>
                  <td className="p-3 text-end"><b className={cn("tabular-nums", r.status === "void" && "line-through opacity-50")}>{formatIQD(r.amount, locale)}</b><span className="block text-[11px] text-mute">{earningNote(r)}</span></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
