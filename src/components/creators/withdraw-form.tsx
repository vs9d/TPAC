"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { requestWithdrawal } from "@/lib/actions/creators";
import { formatIQD } from "@/lib/format";

export function WithdrawForm({ available, min, methods }: { available: number; min: number; methods: string[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [amount, setAmount] = useState(available);
  const [method, setMethod] = useState(methods[0] ?? "");
  const [account, setAccount] = useState("");
  const [pending, start] = useTransition();
  const can = available >= min;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await requestWithdrawal({ amount, method, account });
      if (!r.ok) { toast.error(r.error === "min" ? (ar ? `أقل مبلغ للسحب ${formatIQD(min, locale)}` : `Minimum is ${formatIQD(min, locale)}`) : r.error === "balance" ? (ar ? "المبلغ أكثر من رصيدك المتاح" : "More than your available balance") : ar ? "تأكد من الخانات" : "Check the fields"); return; }
      toast.success(ar ? "وصل طلب السحب ✓ نراجعه ونحوّل لك" : "Request received ✓");
      setAccount("");
      router.refresh();
    }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "المبلغ" : "Amount"}</span><input type="number" min={min} max={available} step={1} value={amount} onChange={(e) => setAmount(Math.round(Number(e.target.value) || 0))} className="field w-full" disabled={!can} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "طريقة الاستلام" : "Method"}</span><select value={method} onChange={(e) => setMethod(e.target.value)} className="field w-full" disabled={!can}>{methods.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "رقم المحفظة / الحساب" : "Wallet / account"}</span><input value={account} onChange={(e) => setAccount(e.target.value)} maxLength={200} dir="ltr" className="field w-full" disabled={!can} /></label>
      </div>
      <button type="submit" disabled={!can || pending || account.trim().length < 3} className="btn btn-brand h-12 w-full sm:w-auto">{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {ar ? "طلب سحب" : "Request withdrawal"}</button>
      {!can && <p className="text-xs text-mute">{ar ? `تكدر تسحب لما يوصل رصيدك المتاح ${formatIQD(min, locale)}.` : `You can withdraw once your available balance reaches ${formatIQD(min, locale)}.`}</p>}
    </form>
  );
}
