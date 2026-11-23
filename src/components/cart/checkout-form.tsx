"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { useCart, lineKey } from "./store";
import { useQuote } from "./use-quote";
import { OrderSummary } from "./order-summary";
import { DiscountInput } from "./discount-input";
import { placeOrder } from "@/lib/actions/checkout";
import { formatIQD, cn } from "@/lib/format";
import { GOVERNORATES } from "@/lib/iraq";
import { normalizeIraqiPhone, formatIraqiPhone } from "@/lib/phone";
import type { Address, DeliveryZone } from "@/lib/types";

interface Prefill { full_name?: string | null; phone?: string | null; email?: string | null }

export function CheckoutForm({ zones, addresses, prefill, signedIn, onlinePayment }: { zones: DeliveryZone[]; addresses: Address[]; prefill: Prefill; signedIn: boolean; onlinePayment: boolean }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const clear = useCart((s) => s.clear);
  const discountCode = useCart((s) => s.discountCode);
  const def = addresses.find((a) => a.is_default) ?? addresses[0];
  const [f, setF] = useState({
    customer_name: def?.full_name ?? prefill.full_name ?? "",
    phone: formatIraqiPhone(def?.phone ?? prefill.phone ?? "") || "",
    email: prefill.email ?? "",
    governorate: def?.governorate ?? "",
    city: def?.city ?? "",
    address_line: def?.address_line ?? "",
    delivery_notes: def?.notes ?? "",
    delivery_method: "standard" as "standard" | "express" | "pickup",
    payment_method: "cod" as "cod" | "online",
    save_address: !addresses.length,
    whatsapp_opt_in: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { quote, loading, lines, hydrated } = useQuote({ governorate: f.governorate, delivery_method: f.delivery_method, phone: f.phone });
  const zone = zones.find((z) => z.governorate === f.governorate);
  const set = (k: keyof typeof f, v: string | boolean) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  useEffect(() => {
    if (!zone) return;
    if (f.delivery_method === "express" && zone.express_fee === null) set("delivery_method", "standard");
    if (f.delivery_method === "pickup" && !zone.pickup_available) set("delivery_method", "standard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.governorate]);

  if (!hydrated) return <div className="skeleton h-96" />;
  if (!lines.length)
    return (
      <div className="py-24 text-center">
        <p className="display text-3xl">{dict.cart.empty}</p>
        <Link href={`/${locale}/shop`} className="btn btn-primary mt-6">{dict.common.shopNow}</Link>
      </div>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.customer_name.trim()) errs.customer_name = "required";
    if (!normalizeIraqiPhone(f.phone)) errs.phone = "phone";
    if (!f.governorate) errs.governorate = "required";
    if (!f.city.trim()) errs.city = "required";
    if (!f.address_line.trim()) errs.address_line = "required";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0]!)?.focus();
      return;
    }
    setFormError(null);
    start(async () => {
      const res = await placeOrder({
        items: lines.map((l) => (l.variant_id ? { variant_id: l.variant_id, quantity: l.quantity } : { custom_design_id: l.custom_design_id!, quantity: l.quantity })),
        customer_name: f.customer_name,
        phone: f.phone,
        email: f.email || undefined,
        governorate: f.governorate,
        city: f.city,
        address_line: f.address_line,
        delivery_notes: f.delivery_notes || undefined,
        delivery_method: f.delivery_method,
        payment_method: f.payment_method,
        discount_code: discountCode || undefined,
        save_address: signedIn && f.save_address,
        whatsapp_opt_in: f.whatsapp_opt_in,
        locale,
      });
      if (res.ok) {
        clear();
        router.replace(`/${locale}/checkout/success?order=${res.order_number}`);
      } else {
        if (res.fields) setErrors(res.fields);
        setFormError(dict.checkout.errors[res.error] ?? dict.checkout.errors.generic!);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-danger" id={`${k}-err`}>{dict.validation[errors[k] as keyof typeof dict.validation] ?? dict.validation.required}</p>;
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={k} className="label">{label}</label>
      <input id={k} value={f[k] as string} onChange={(e) => set(k, e.target.value)} className="field" aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} {...props} />
      {err(k)}
    </div>
  );

  const methods: { id: "standard" | "express" | "pickup"; label: string; fee: number | null; note: string; available: boolean }[] = [
    { id: "standard", label: dict.checkout.standard, fee: zone?.standard_fee ?? null, note: zone ? fmt(dict.checkout.days, { min: zone.estimated_days_min, max: zone.estimated_days_max }) : "", available: true },
    { id: "express", label: dict.checkout.express, fee: zone?.express_fee ?? null, note: dict.checkout.sameDay, available: !!zone && zone.express_fee !== null },
    { id: "pickup", label: dict.checkout.pickup, fee: 0, note: locale === "ar" ? "بغداد" : "Baghdad", available: !!zone?.pickup_available },
  ];
  const qmap = new Map((quote?.lines ?? []).map((l) => [l.variant_id ?? `d:${l.custom_design_id}`, l]));
  const blocking = quote?.lines.some((l) => l.error) || quote?.errors.some((e) => e.code === "min_order_total");

  return (
    <form onSubmit={submit} noValidate className="grid gap-12 lg:grid-cols-12">
      <div className="space-y-10 lg:col-span-7">
        {formError && <p className="bg-danger/10 p-4 text-sm font-semibold text-danger" role="alert">{formError}</p>}
        {!signedIn && (
          <p className="text-sm text-mute">
            {dict.checkout.guestNote}{" "}
            <Link href={`/${locale}/account/login?next=/${locale}/checkout`} className="font-semibold text-ink underline">{dict.checkout.loginForFaster}</Link>
          </p>
        )}

        <section>
          <h2 className="display mb-5 text-2xl">{dict.checkout.contact}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("customer_name", dict.checkout.fullName, { autoComplete: "name", required: true })}
            <div>
              <label htmlFor="phone" className="label">{dict.checkout.phone}</label>
              <input id="phone" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder={dict.checkout.phoneHint} value={f.phone} onChange={(e) => set("phone", e.target.value)} onBlur={() => { const n = normalizeIraqiPhone(f.phone); if (n) set("phone", formatIraqiPhone(n)); }} className="field text-start" aria-invalid={!!errors.phone} required />
              {err("phone")}
            </div>
            <div className="sm:col-span-2">{field("email", `${dict.checkout.email} (${dict.common.optional})`, { type: "email", autoComplete: "email", dir: "ltr" })}</div>
          </div>
        </section>

        <section>
          <h2 className="display mb-5 text-2xl">{dict.checkout.delivery}</h2>
          {addresses.length > 0 && (
            <div className="mb-5">
              <p className="label">{dict.checkout.savedAddresses}</p>
              <div className="flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setF((s) => ({ ...s, customer_name: a.full_name, phone: formatIraqiPhone(a.phone), governorate: a.governorate, city: a.city, address_line: a.address_line, delivery_notes: a.notes ?? "", save_address: false }))}
                    className={cn("rounded-2xl border px-3 py-2 text-start text-xs", f.address_line === a.address_line ? "border-ink" : "border-line")}
                  >
                    <span className="font-semibold">{a.label || a.city}</span>
                    <span className="block text-mute">{a.address_line.slice(0, 40)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="governorate" className="label">{dict.checkout.governorate}</label>
              <select id="governorate" value={f.governorate} onChange={(e) => set("governorate", e.target.value)} className="field" aria-invalid={!!errors.governorate} required>
                <option value="">{dict.checkout.selectGovernorate}</option>
                {GOVERNORATES.filter((g) => zones.some((z) => z.governorate === g.code)).map((g) => (
                  <option key={g.code} value={g.code}>{g[locale]}</option>
                ))}
              </select>
              {err("governorate")}
            </div>
            {field("city", dict.checkout.city, { autoComplete: "address-level2", required: true })}
            <div className="sm:col-span-2">
              <label htmlFor="address_line" className="label">{dict.checkout.address}</label>
              <textarea id="address_line" rows={2} value={f.address_line} onChange={(e) => set("address_line", e.target.value)} placeholder={dict.checkout.addressHint} className="field" aria-invalid={!!errors.address_line} autoComplete="street-address" required maxLength={500} />
              {err("address_line")}
            </div>
            <div className="sm:col-span-2">{field("delivery_notes", `${dict.checkout.instructions} (${dict.common.optional})`, { placeholder: dict.checkout.instructionsHint, maxLength: 500 })}</div>
            <label className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm sm:col-span-2">
              <input type="checkbox" name="whatsapp_opt_in" className="mt-0.5 size-5 shrink-0 accent-[var(--color-pine)]" checked={f.whatsapp_opt_in} onChange={(e) => set("whatsapp_opt_in", e.target.checked)} />
              <span>
                <span className="block font-semibold">{locale === "ar" ? "أرسلولي تحديثات الطلب على الواتساب" : "Send me order updates on WhatsApp"}</span>
                <span className="block text-xs text-mute">{locale === "ar" ? "تأكيد الطلب، التجهيز، الشحن والتسليم — على نفس رقم الهاتف. تگدر توقفها بأي وقت بمراسلتنا." : "Confirmation, preparation, shipping and delivery — to this phone number. Message us any time to stop them."}</span>
              </span>
            </label>
            {signedIn && (
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-ink" checked={f.save_address} onChange={(e) => set("save_address", e.target.checked)} /> {dict.checkout.saveAddress}
              </label>
            )}
          </div>
        </section>

        <section>
          <h2 className="display mb-5 text-2xl">{dict.checkout.deliveryMethod}</h2>
          <div className="space-y-2" role="radiogroup" aria-label={dict.checkout.deliveryMethod}>
            {methods.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition", f.delivery_method === m.id ? "border-ink" : "border-line", !m.available && "cursor-not-allowed opacity-40")}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="delivery_method" className="size-4 accent-ink" checked={f.delivery_method === m.id} disabled={!m.available} onChange={() => set("delivery_method", m.id)} />
                  <span>
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="text-xs text-mute">{m.available ? m.note : dict.checkout.notAvailable}</span>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{m.available && m.fee !== null ? (m.fee === 0 ? dict.common.free : formatIQD(m.fee, locale)) : "—"}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="display mb-5 text-2xl">{dict.checkout.payment}</h2>
          <div className="space-y-2">
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4", f.payment_method === "cod" ? "border-ink" : "border-line")}>
              <input type="radio" name="payment_method" className="mt-1 size-4 accent-ink" checked={f.payment_method === "cod"} onChange={() => set("payment_method", "cod")} />
              <span>
                <span className="block text-sm font-semibold">{dict.checkout.cod}</span>
                <span className="text-xs text-mute">{dict.checkout.codBody}</span>
              </span>
            </label>
            {onlinePayment && (
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4", f.payment_method === "online" ? "border-ink" : "border-line")}>
                <input type="radio" name="payment_method" className="mt-1 size-4 accent-ink" checked={f.payment_method === "online"} onChange={() => set("payment_method", "online")} />
                <span className="text-sm font-semibold">{dict.checkout.online}</span>
              </label>
            )}
          </div>
        </section>
      </div>

      <aside className="lg:col-span-5">
        <div className="space-y-6 rounded-[1.75rem] bg-bone p-6 lg:sticky lg:top-28">
          <h2 className="display text-2xl">{dict.checkout.review}</h2>
          <ul className="max-h-72 space-y-4 overflow-y-auto">
            {lines.map((l) => {
              const q = qmap.get(lineKey(l));
              const img = q?.image_url ?? l.snapshot?.image;
              return (
                <li key={lineKey(l)} className="flex gap-3">
                  <div className="relative h-20 w-16 shrink-0 bg-stone">
                    {img && <Image src={img} alt="" fill sizes="64px" className="object-cover" unoptimized={img.startsWith("data:") || img.includes("token=")} />}
                    <span className="absolute -end-2 -top-2 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-paper">{l.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-1 font-semibold">{q ? (locale === "ar" ? q.name_ar : q.name_en) : locale === "ar" ? l.snapshot?.name_ar : l.snapshot?.name_en}</p>
                    <p className="text-xs text-mute">{[q?.size_code ?? l.snapshot?.size, locale === "ar" ? q?.color_name_ar : q?.color_name_en].filter(Boolean).join(" · ")}</p>
                    {q?.error && <p className="text-xs font-semibold text-danger">{q.error === "insufficient_stock" ? fmt(dict.cart.insufficientStock, { n: q.available ?? 0 }) : dict.cart.unavailable}</p>}
                  </div>
                  <p className="text-sm tabular-nums">{q ? formatIQD(q.line_total, locale) : ""}</p>
                </li>
              );
            })}
          </ul>
          <DiscountInput quote={quote} />
          <OrderSummary quote={quote} showDelivery={!!f.governorate} loading={loading} />
          <button type="submit" disabled={pending || !!blocking || !quote} className="btn btn-primary h-14 w-full text-base">
            {pending ? <><Loader2 className="size-4 animate-spin" /> {dict.checkout.placing}</> : <><Lock className="size-4" /> {dict.checkout.placeOrder}</>}
          </button>
          {blocking && <Link href={`/${locale}/cart`} className="block text-center text-xs font-semibold text-danger underline">{dict.cart.issues}</Link>}
          <p className="text-center text-xs text-mute">{dict.checkout.terms}</p>
        </div>
      </aside>
    </form>
  );
}
