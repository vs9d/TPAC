"use client";
import { Copy, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";

/** Share a creator page or design: WhatsApp and Facebook open directly; Instagram and TikTok take the copied link. */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const full = () => (url.startsWith("http") ? url : `${window.location.origin}${url}`);
  const copy = async (then?: string) => {
    try {
      await navigator.clipboard.writeText(full());
      toast.success(then ? (ar ? `انسخ الرابط — الصقه بـ ${then}` : `Link copied — paste it in ${then}`) : ar ? "انسخ الرابط" : "Link copied");
    } catch {
      toast.error(ar ? "ما قدرنا ننسخ" : "Couldn't copy");
    }
  };
  const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold transition hover:border-ink";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={ar ? "مشاركة" : "Share"}>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url.startsWith("http") ? url : ""}`)}`} onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${full()}`)}`; }} target="_blank" rel="noopener noreferrer" ><MessageCircle className="size-4" /> WhatsApp</a>
      <a className={btn} href="https://www.facebook.com/sharer/sharer.php" onClick={(e) => { e.currentTarget.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(full())}`; }} target="_blank" rel="noopener noreferrer" >Facebook</a>
      <button type="button" className={btn} onClick={() => void copy("Instagram")}>Instagram</button>
      <button type="button" className={btn} onClick={() => void copy("TikTok")}>TikTok</button>
      <button type="button" className={btn} onClick={() => void copy()}><Copy className="size-4" /> {ar ? "نسخ الرابط" : "Copy link"}</button>
    </div>
  );
}
