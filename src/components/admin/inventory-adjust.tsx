"use client";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Submit } from "./form";
import { adjustInventory } from "@/lib/actions/admin/catalog";

export function InventoryAdjustForm({ variantId }: { variantId: string }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  return (
    <AdminForm action={adjustInventory} resetOnSuccess className="flex items-center gap-1.5">
      <input type="hidden" name="variant_id" value={variantId} />
      <input name="change" type="number" required placeholder="+10 / -2" className="field h-8 w-20 px-2 text-xs" aria-label={t("التغيير", "Change")} />
      <select name="reason" className="field h-8 w-28 px-1 text-xs" aria-label={t("السبب", "Reason")}>
        <option value="restock">{t("إعادة تخزين", "Restock")}</option>
        <option value="adjustment">{t("تصحيح جرد", "Count correction")}</option>
        <option value="return">{t("مرتجع", "Return")}</option>
        <option value="damage">{t("تالف", "Damaged")}</option>
      </select>
      <input name="note" placeholder={t("ملاحظة", "Note")} className="field h-8 w-28 px-2 text-xs" aria-label={t("ملاحظة", "Note")} />
      <Submit variant="outline" className="h-8">✓</Submit>
    </AdminForm>
  );
}
