"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

/**
 * "Get the TPAC app": installs the site as an app on the phone's home screen.
 * - Android / Chrome / Edge: the browser's own install dialog (captured early in <head> as window.__tpacInstall).
 * - iPhone / iPad (Safari): step-by-step instructions (Share → Add to Home Screen), since iOS has no install button.
 * - In-app browsers (Instagram, TikTok, Facebook): first open the page in Safari / Chrome.
 * Hidden once the app is installed (opened from the home screen).
 */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Mode = "prompt" | "ios" | "android" | "inapp";
declare global { interface Window { __tpacInstall?: PromptEvent | null } }

const DISMISS_KEY = "tpac-install-dismissed";
const DISMISS_DAYS = 14;
const OPEN_EVENT = "tpac:install";

/** Whether the admin shows the "Get the app" offers (Admin → Settings → Phone app). Off by default. */
const InstallEnabled = createContext(false);
export function InstallSettings({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <InstallEnabled.Provider value={enabled}>{children}</InstallEnabled.Provider>;
}
export const useInstallEnabled = () => useContext(InstallEnabled);

function detect(): { installed: boolean; mode: Mode | null } {
  if (typeof window === "undefined") return { installed: false, mode: null };
  const nav = navigator as Navigator & { standalone?: boolean };
  const installed = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  if (installed) return { installed, mode: null };
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|Line\//i.test(ua);
  if (inApp) return { installed, mode: "inapp" };
  if (window.__tpacInstall) return { installed, mode: "prompt" };
  if (ios) return { installed, mode: "ios" };
  if (/Android/i.test(ua)) return { installed, mode: "android" };
  return { installed, mode: null }; // desktop browsers without an install offer: nothing to show
}

function useInstall() {
  const [state, setState] = useState<{ installed: boolean; mode: Mode | null }>({ installed: false, mode: null });
  useEffect(() => {
    const update = () => setState(detect());
    update();
    window.addEventListener("tpac:installable", update);
    window.addEventListener("appinstalled", update);
    return () => {
      window.removeEventListener("tpac:installable", update);
      window.removeEventListener("appinstalled", update);
    };
  }, []);
  return state;
}

const dismissedRecently = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

const rememberDismiss = () => {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
};

/** Banner (mobile, after a few seconds on browsing pages) + the install sheet; mounted once in the store layout. */
export function InstallPrompt() {
  const enabled = useInstallEnabled();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const path = usePathname();
  const { mode } = useInstall();
  const [banner, setBanner] = useState(false);
  const [sheet, setSheet] = useState(false);

  // a browsing page (not checkout, the studio, account or a product page with its buy bar)
  const browsing = /^\/(ar|en)(\/(shop|collections|community|creators|creator\/[^/]+|couples|reviews|portfolio|size-finder))?\/?$/.test(path);

  useEffect(() => {
    if (!enabled || !mode || !browsing || dismissedRecently() || window.innerWidth >= 768) return;
    const t = window.setTimeout(() => setBanner(true), 6000);
    return () => window.clearTimeout(t);
  }, [enabled, mode, browsing]);

  const install = useCallback(async () => {
    const e = window.__tpacInstall;
    if (e) {
      await e.prompt();
      const choice = await e.userChoice.catch(() => null);
      window.__tpacInstall = null;
      setBanner(false);
      if (choice?.outcome === "dismissed") rememberDismiss();
      return;
    }
    setSheet(true);
  }, []);

  useEffect(() => {
    const open = () => void install();
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [install]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const dismiss = () => {
    setBanner(false);
    rememberDismiss();
  };

  if (!enabled) return null;
  return (
    <>
      {banner && mode && (
        <div role="region" aria-label={ar ? "تطبيق TPAC" : "TPAC app"} className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,.35)] md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-96.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{ar ? "نزّل تطبيق TPAC" : "Get the TPAC app"}</p>
            <p className="truncate text-xs text-mute">{ar ? "أسرع، وتوصلك إشعارات طلبك" : "Faster, with order updates"}</p>
          </div>
          <button type="button" onClick={() => void install()} className="btn btn-brand h-11 shrink-0 px-4 text-sm">
            <Download className="size-4" aria-hidden /> {ar ? "نزّله" : "Install"}
          </button>
          <button type="button" onClick={dismiss} className="grid size-11 shrink-0 place-items-center rounded-full text-mute" aria-label={ar ? "مو هسه" : "Not now"}>
            <X className="size-5" />
          </button>
        </div>
      )}
      {sheet && mode && <InstallSheet mode={mode} ar={ar} onClose={() => setSheet(false)} />}
    </>
  );
}

function InstallSheet({ mode, ar, onClose }: { mode: Mode; ar: boolean; onClose: () => void }) {
  const steps: { icon: React.ReactNode; text: string }[] =
    mode === "inapp"
      ? [
          { icon: <MoreVertical className="size-5" />, text: ar ? "دوس على ⋯ أو ⋮ فوق بالزاوية" : "Tap ⋯ or ⋮ in the top corner" },
          { icon: <Share className="size-5" />, text: ar ? "اختار «فتح بالمتصفح» (Safari أو Chrome)" : "Choose “Open in browser” (Safari or Chrome)" },
          { icon: <SquarePlus className="size-5" />, text: ar ? "من هناك دوس «نزّل تطبيق TPAC» مرة ثانية" : "Then tap “Get the TPAC app” again" },
        ]
      : mode === "ios"
        ? [
            { icon: <Share className="size-5" />, text: ar ? "دوس زر المشاركة بالأسفل (المربع اللي بيه سهم لفوق)" : "Tap the Share button (the square with an arrow)" },
            { icon: <SquarePlus className="size-5" />, text: ar ? "انزل واختار «إضافة إلى الشاشة الرئيسية»" : "Scroll and choose “Add to Home Screen”" },
            { icon: <Download className="size-5" />, text: ar ? "دوس «إضافة» — وتطلع أيقونة TPAC بشاشتك" : "Tap “Add” — the TPAC icon appears on your home screen" },
          ]
        : [
            { icon: <MoreVertical className="size-5" />, text: ar ? "دوس على ⋮ فوق بالمتصفح" : "Tap ⋮ in the browser" },
            { icon: <SquarePlus className="size-5" />, text: ar ? "اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»" : "Choose “Install app” or “Add to Home screen”" },
            { icon: <Download className="size-5" />, text: ar ? "وافق — وتطلع أيقونة TPAC بشاشتك" : "Confirm — the TPAC icon appears on your home screen" },
          ];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="w-full max-w-md rounded-[1.5rem] bg-paper p-5 shadow-2xl" style={{ marginBottom: "env(safe-area-inset-bottom)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-96.png" alt="" width={48} height={48} className="size-12 rounded-xl" />
          <div className="flex-1">
            <h2 id="install-title" className="text-lg font-bold">{ar ? "نزّل تطبيق TPAC" : "Get the TPAC app"}</h2>
            <p className="text-sm text-mute">{mode === "inapp" ? (ar ? "من داخل إنستغرام أو تيك توك ما يصير — افتح الرابط بالمتصفح أولاً." : "Not possible inside Instagram or TikTok — open the link in your browser first.") : ar ? "مجاني، بدون App Store، وياخذ ثواني." : "Free, no app store, takes seconds."}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-mute" aria-label={ar ? "إغلاق" : "Close"} autoFocus><X className="size-5" /></button>
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-bone p-3 text-sm font-semibold">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine text-sm font-bold text-white" aria-hidden>{i + 1}</span>
              <span className="flex-1">{s.text}</span>
              <span className="text-pine" aria-hidden>{s.icon}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="btn btn-outline mt-4 h-12 w-full">{ar ? "تمام" : "Got it"}</button>
      </div>
    </div>
  );
}

/** A "Get the app" link for the footer and the menu; hidden when installed or not installable on this device. */
export function InstallAppLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  const enabled = useInstallEnabled();
  const { locale } = useI18n();
  const { mode } = useInstall();
  if (!enabled || !mode) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={cn("text-start", className)}>
      {children ?? (locale === "ar" ? "نزّل تطبيق TPAC" : "Get the TPAC app")}
    </button>
  );
}
