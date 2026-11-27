"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { createCreatorDraft } from "@/lib/actions/creators";

export function NewDesignButton({ typeId, children, className }: { typeId: string; children: React.ReactNode; className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={className}
      onClick={() => start(async () => {
        const r = await createCreatorDraft(typeId);
        if (!r.ok) { toast.error(locale === "ar" ? "ما قدرنا نبدي — حاول مرة ثانية" : "Couldn't start — try again"); return; }
        router.push(`/${locale}/creator-studio/designs/${r.id}`);
      })}>
      {pending ? <Loader2 className="mx-auto size-6 animate-spin" /> : children}
    </button>
  );
}
