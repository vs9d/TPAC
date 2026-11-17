"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { trackOrder } from "@/lib/actions/forms";
import { useI18n } from "@/components/i18n-provider";
import { StatusTimeline } from "./status-timeline";
import { formatDate, formatIQD } from "@/lib/format";
import { governorateName } from "@/lib/iraq";
import type { OrderStatus } from "@/lib/order-status";

export function TrackForm({ initialOrder }: { initialOrder: string }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(trackOrder, null);
  return (
    <div className="mt-10">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="order_number" className="label">{dict.track.orderNumber}</label>
          <input id="order_number" name="order_number" defaultValue={initialOrder} required placeholder={dict.track.orderNumberHint} className="field uppercase" dir="ltr" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="track-phone" className="label">{dict.track.phone}</label>
          <input id="track-phone" name="phone" type="tel" inputMode="tel" required placeholder="07xx xxx xxxx" className="field" dir="ltr" autoComplete="tel" />
        </div>
        <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 className="size-4 animate-spin" /> : dict.track.submit}</button>
      </form>
      {state?.ok === false && (
        <p className="mt-6 bg-danger/10 p-4 text-sm font-medium text-danger" role="alert">
          {state.error === "rate_limited" ? dict.checkout.errors.rate_limited : dict.track.notFound}
        </p>
      )}
      {state?.ok && (
        <div className="mt-10 grid gap-10 border-t border-line pt-10 md:grid-cols-2">
          <div>
            <p className="eyebrow text-mute">{dict.track.currentStatus}</p>
            <p className="display mt-2 text-3xl">{dict.status[state.order.status]}</p>
            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-mute">{dict.checkout.orderNumber}</dt><dd dir="ltr" className="font-semibold">{state.order.order_number}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{dict.account.placedOn}</dt><dd>{formatDate(state.order.created_at, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{dict.checkout.governorate}</dt><dd>{governorateName(state.order.governorate, locale)} — {state.order.city}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{dict.common.total}</dt><dd className="font-semibold">{formatIQD(state.order.total, locale)}</dd></div>
            </dl>
            <ul className="mt-6 space-y-1 border-t border-line pt-4 text-sm">
              {state.order.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{locale === "ar" ? it.name_ar : it.name_en} {it.size_code && <span className="text-mute">· {it.size_code}</span>}</span>
                  <span className="text-mute">×{it.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-5 text-mute">{dict.track.timeline}</p>
            <StatusTimeline status={state.order.status as OrderStatus} history={state.order.history} />
          </div>
        </div>
      )}
    </div>
  );
}
