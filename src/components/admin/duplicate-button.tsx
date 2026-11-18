"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { duplicateProductAction } from "@/lib/actions/admin/products";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/format";

export function DuplicateButton({ id, copyStock = false, variant = "icon", className }: { id: string; copyStock?: boolean; variant?: "icon" | "button"; className?: string }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await duplicateProductAction(id, copyStock);
      if (r.ok && r.id) {
        toast.success(t("تم النسخ — عدّل الاسم والصور وانشره", "Duplicated — edit the name & photos, then publish"));
        router.push(`/${locale}/admin/products/${r.id}`);
      } else toast.error(t("تعذّر النسخ", "Could not duplicate"));
    });
  const label = copyStock ? t("نسخ مع المخزون", "Duplicate with stock") : t("نسخ المنتج", "Duplicate");
  return variant === "icon" ? (
    <button type="button" onClick={run} disabled={pending} aria-label={label} title={label} data-ripple className={cn("grid size-9 place-items-center rounded-full border border-line hover:bg-bone", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
    </button>
  ) : (
    <button type="button" onClick={run} disabled={pending} className={cn("btn btn-outline btn-sm", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} {label}
    </button>
  );
}
