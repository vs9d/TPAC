"use client";
import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { deletePushSubscription, pushPublicKey, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { InstallAppLink } from "./install";
import { cn } from "@/lib/format";

type State = "loading" | "unsupported" | "install-first" | "denied" | "off" | "on";

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

/**
 * "Notify me on my phone": order updates (customers), sales and payouts (creators), new orders (staff).
 * On iPhone, web notifications only work from the installed app, so it asks to install first.
 */
export function PushToggle({ context = "orders", className }: { context?: "orders" | "creator" | "staff"; className?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      // iPhone / iPad: web notifications only exist in the app opened from the home screen
      if (isIOS() && !standalone()) return setState("install-first");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = () => start(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    try {
      const key = await pushPublicKey();
      if (!key) throw new Error("no_key");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const r = await savePushSubscription({ ...sub.toJSON(), locale });
      if (!r.ok) throw new Error(r.error);
      setState("on");
      toast.success(ar ? "تفعّلت الإشعارات ✓" : "Notifications on ✓");
    } catch {
      toast.error(ar ? "ما قدرنا نفعّلها — جرّب مرة ثانية" : "Couldn't turn them on — try again");
    }
  });

  const turnOff = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe().catch(() => undefined);
    }
    setState("off");
  });

  const test = () => start(async () => {
    const r = await sendTestPush(locale);
    if (!r.ok) toast.error(ar ? "ما وصل — تأكد إن الإشعارات مسموحة للتطبيق" : "Not delivered — check notification permissions");
  });

  const lead = context === "creator"
    ? (ar ? "توصلك على الموبايل كل بيعة وكل تحويل أرباح." : "Get every sale and payout on your phone.")
    : context === "staff"
      ? (ar ? "يوصلك كل طلب جديد على الموبايل." : "Get every new order on your phone.")
      : (ar ? "توصلك حالة طلبك على الموبايل: تأكيد، شحن، تسليم." : "Get your order updates on your phone: confirmed, shipped, delivered.");

  if (state === "loading" || state === "unsupported") return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper p-4", className)} role="group" aria-label={ar ? "إشعارات الموبايل" : "Phone notifications"}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", state === "on" ? "bg-pine-soft text-pine" : "bg-bone")} aria-hidden>
        {state === "on" ? <BellRing className="size-5" /> : state === "denied" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{state === "on" ? (ar ? "إشعارات الموبايل شغّالة" : "Phone notifications on") : (ar ? "إشعارات على الموبايل" : "Phone notifications")}</p>
        <p className="text-xs text-mute">
          {state === "install-first" ? (ar ? "بالآيفون الإشعارات تشتغل من تطبيق TPAC — نزّله أولاً (ثواني ومجاني)." : "On iPhone, notifications work from the TPAC app — install it first (free, seconds).")
            : state === "denied" ? (ar ? "مقفولة من إعدادات الموبايل — افتح الإعدادات ← الإشعارات ← TPAC وفعّلها." : "Blocked in your phone settings — open Settings → Notifications → TPAC.")
              : lead}
        </p>
      </div>
      {state === "install-first" && <InstallAppLink className="btn btn-brand h-11 px-4 text-sm">{ar ? "نزّل التطبيق" : "Get the app"}</InstallAppLink>}
      {state === "off" && <button type="button" onClick={turnOn} disabled={pending} className="btn btn-brand h-11 px-4 text-sm">{pending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} {ar ? "فعّلها" : "Turn on"}</button>}
      {state === "on" && (
        <div className="flex gap-2">
          <button type="button" onClick={test} disabled={pending} className="btn btn-outline h-11 px-4 text-sm">{ar ? "جرّب" : "Test"}</button>
          <button type="button" onClick={turnOff} disabled={pending} className="btn btn-outline h-11 px-4 text-sm">{ar ? "طفّيها" : "Turn off"}</button>
        </div>
      )}
    </div>
  );
}
