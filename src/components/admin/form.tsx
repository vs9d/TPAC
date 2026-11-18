"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import type { ActionState } from "@/lib/actions/admin/common";
import { cn } from "@/lib/format";

const ERR: Record<string, [string, string]> = {
  duplicate: ["القيمة موجودة مسبقاً (مكرر)", "Already exists (duplicate)"],
  not_authorized: ["ليست لديك صلاحية", "Not authorised"],
  in_use: ["لا يمكن الحذف لأنه مستخدم", "Can't delete: it's in use"],
  validation: ["تحقق من الحقول المظللة", "Check the highlighted fields"],
  constraint: ["قيمة غير صالحة", "Invalid value"],
  invalid_transition: ["لا يمكن الانتقال لهذه الحالة", "This status change isn't allowed"],
  insufficient_stock: ["المخزون لا يكفي", "Not enough stock"],
};

/** Server-action form with toast feedback, field errors and optional redirect/refresh. */
export function AdminForm({
  action,
  children,
  className,
  id,
  redirectTo,
  resetOnSuccess = false,
  successMessage,
  onSuccess,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** URL to go to on success; "{id}" is replaced with the id returned by the action. */
  redirectTo?: string;
  resetOnSuccess?: boolean;
  successMessage?: string;
  /** Return "handled" to skip the default redirect/refresh (e.g. "save and add another"). */
  onSuccess?: (state: Extract<ActionState, { ok: true }>) => "handled" | void;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(successMessage ?? state.message ?? (locale === "ar" ? "تم الحفظ" : "Saved"));
      if (resetOnSuccess) ref.current?.reset();
      if (onSuccess?.(state) === "handled") return;
      if (redirectTo) router.push(redirectTo.replace("{id}", state.id ?? ""));
      else router.refresh();
    } else {
      const e = ERR[state.error] ?? [state.error === "generic" ? "حدث خطأ" : state.error, state.error === "generic" ? "Something went wrong" : state.error];
      toast.error(locale === "ar" ? e[0] : e[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const fields = state && !state.ok ? state.fields : undefined;
  return (
    <form id={id} ref={ref} action={formAction} data-reset={resetOnSuccess ? "true" : undefined} className={cn("relative", className)} data-pending={pending || undefined}>
      <FieldErrorsContext.Provider value={fields}>{children}</FieldErrorsContext.Provider>
    </form>
  );
}

import { createContext, useContext } from "react";
import { useFormStatus } from "react-dom";
const FieldErrorsContext = createContext<Record<string, string> | undefined>(undefined);

export function Field({ name, label, hint, className, children }: { name?: string; label: string; hint?: string; className?: string; children: React.ReactNode }) {
  const errors = useContext(FieldErrorsContext);
  const err = name ? errors?.[name] : undefined;
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && !err && <p className="mt-1 text-xs text-mute">{hint}</p>}
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

export function Input({ name, label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: string }) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      <input id={name} name={name} className="field h-10 text-sm" {...props} />
    </Field>
  );
}

export function Textarea({ name, label, hint, className, rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string; hint?: string }) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      <textarea id={name} name={name} rows={rows} className="field text-sm" {...props} />
    </Field>
  );
}

export function Select({ name, label, hint, className, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; hint?: string; options: { value: string; label: string }[] }) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      <select id={name} name={name} className="field h-10 text-sm" {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Checkbox({ name, label, defaultChecked, className }: { name: string; label: string; defaultChecked?: boolean; className?: string }) {
  return (
    <label className={cn("flex items-center gap-2.5 text-sm", className)}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-ink" /> {label}
    </label>
  );
}

export function Submit({ children, className, variant = "primary", name, value }: { children: React.ReactNode; className?: string; variant?: "primary" | "outline" | "danger" | "accent" | "brand"; name?: string; value?: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cn("btn btn-sm h-10", `btn-${variant}`, className)}>
      {mine && <Loader2 className="size-4 animate-spin" />} {children}
    </button>
  );
}

export function ConfirmSubmit({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn btn-sm h-9 border border-danger text-danger hover:bg-danger hover:text-paper", className)} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
