"use client";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart/store";
import { toast } from "@/components/ui/toast";
import type { ResolvedOption } from "@/lib/couple-options";

interface Item { variant_id: string; quantity: number; name_ar: string; name_en: string; image: string | null; size?: string; color_hex?: string; options?: ResolvedOption[] }
// the answers of a couple set go back in the bag as they were (size_1 is the line's own size)
const answers = (o?: ResolvedOption[]) => (o?.length ? Object.fromEntries(o.filter((x) => x.key !== "size_1").map((x) => [x.key, x.value])) : undefined);

/** Adds the order's catalog items back into the bag. Stock/prices are re-validated by the cart quote. */
export function ReorderButton({ items }: { items: Item[] }) {
  const { dict } = useI18n();
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.openDrawer);
  if (!items.length) return null;
  return (
    <button
      className="btn btn-outline btn-sm"
      onClick={() => {
        for (const it of items) add({ variant_id: it.variant_id, quantity: it.quantity, options: answers(it.options), snapshot: { name_ar: it.name_ar, name_en: it.name_en, image: it.image, size: it.size, color_hex: it.color_hex, options: it.options } });
        toast.success(dict.account.reorderDone);
        open(true);
      }}
    >
      <RotateCcw className="size-4" /> {dict.account.reorder}
    </button>
  );
}
