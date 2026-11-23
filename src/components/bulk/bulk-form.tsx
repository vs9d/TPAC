"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { submitBulkRequest } from "@/lib/actions/bulk";
import { uploadArtwork, ACCEPT_BULK } from "@/lib/upload-client";
import { QUOTE_PRODUCT_TYPES } from "@/lib/validation";
import { normalizeIraqiPhone } from "@/lib/phone";

export function BulkForm() {
  const { dict } = useI18n();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done)
    return (
      <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-line bg-bone p-10 text-center" role="status">
        <CheckCircle2 className="size-12 text-pine" strokeWidth={1.4} />
        <p className="text-lg font-semibold">{fmt(dict.bulk.success, { n: done })}</p>
        <p className="display text-3xl tabular-nums" dir="ltr" data-testid="quote-ref">{done}</p>
      </div>
    );

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    setUploading(true);
    for (const f of Array.from(list).slice(0, 5 - files.length)) {
      try {
        const r = await uploadArtwork(f, "bulk");
        setFiles((x) => [...x, { id: r.id, name: f.name }]);
      } catch (e) {
        const k = e instanceof Error ? e.message : "";
        setFormError(k === "fileType" ? dict.validation.fileType : k === "fileSize" ? dict.validation.fileSize : dict.common.somethingWrong);
      }
    }
    setUploading(false);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "");
    const errs: Record<string, string> = {};
    for (const k of ["organization_name", "contact_name", "quantity_min", "quantity_max", "preferred_color"]) if (!String(fd.get(k) ?? "").trim()) errs[k] = "required";
    if (!normalizeIraqiPhone(phone)) errs.phone = "phone";
    if (!errs.quantity_min && !errs.quantity_max && Number(fd.get("quantity_max")) < Number(fd.get("quantity_min"))) errs.quantity_max = "quantity_range";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFormError(null);
    start(async () => {
      const res = await submitBulkRequest({
        organization_name: fd.get("organization_name"),
        contact_name: fd.get("contact_name"),
        phone,
        email: fd.get("email") || undefined,
        product_type: fd.get("product_type"),
        quantity_min: fd.get("quantity_min"),
        quantity_max: fd.get("quantity_max"),
        preferred_color: fd.get("preferred_color"),
        notes: fd.get("notes") || undefined,
        artwork_ids: files.map((f) => f.id),
      });
      if (res.ok) setDone(res.request_number);
      else {
        if (res.fields) setErrors(res.fields);
        setFormError(res.error === "rate_limited" ? dict.checkout.errors.rate_limited! : res.error === "validation" ? null : dict.common.somethingWrong);
      }
    });
  };
  const fe = (k: string) => errors[k] && <p className="mt-1 text-xs text-danger">{dict.validation[errors[k] as keyof typeof dict.validation] ?? dict.validation.required}</p>;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      {formError && <p className="bg-danger/10 p-3 text-sm text-danger sm:col-span-2" role="alert">{formError}</p>}
      <div><label className="label" htmlFor="b-contact">{dict.bulk.contactName}</label><input id="b-contact" name="contact_name" className="field" required autoComplete="name" aria-invalid={!!errors.contact_name} />{fe("contact_name")}</div>
      <div><label className="label" htmlFor="b-phone">{dict.bulk.phone}</label><input id="b-phone" name="phone" type="tel" dir="ltr" className="field" required placeholder="07xx xxx xxxx" autoComplete="tel" aria-invalid={!!errors.phone} />{fe("phone")}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="b-org">{dict.bulk.organization}</label><input id="b-org" name="organization_name" className="field" required maxLength={200} aria-invalid={!!errors.organization_name} />{fe("organization_name")}</div>
      <div><label className="label" htmlFor="b-qmin">{dict.bulk.quantityFrom}</label><input id="b-qmin" name="quantity_min" type="number" min={1} max={100000} inputMode="numeric" className="field" required aria-invalid={!!errors.quantity_min} />{fe("quantity_min")}</div>
      <div><label className="label" htmlFor="b-qmax">{dict.bulk.quantityTo}</label><input id="b-qmax" name="quantity_max" type="number" min={1} max={100000} inputMode="numeric" className="field" required aria-invalid={!!errors.quantity_max} />{fe("quantity_max")}</div>
      <fieldset className="sm:col-span-2">
        <legend className="label">{dict.bulk.productType}</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {QUOTE_PRODUCT_TYPES.map((t, i) => (
            <label key={t} className="relative cursor-pointer">
              <input type="radio" name="product_type" value={t} defaultChecked={i === 0} className="peer sr-only" />
              <span className="flex h-12 items-center justify-center rounded-2xl border border-line text-sm font-bold transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-pine">{dict.bulk.productTypes[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2"><label className="label" htmlFor="b-color">{dict.bulk.preferredColor}</label><input id="b-color" name="preferred_color" className="field" required maxLength={120} placeholder={dict.bulk.preferredColorHint} aria-invalid={!!errors.preferred_color} />{fe("preferred_color")}</div>
      <div className="sm:col-span-2">
        <p className="label">{dict.bulk.logo}</p>
        <label className={`flex cursor-pointer items-center justify-center gap-2 border border-dashed border-ink/40 p-6 text-sm hover:border-ink ${files.length >= 5 || uploading ? "pointer-events-none opacity-50" : ""}`}>
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <FileUp className="size-5" />}
          {dict.bulk.logo}
          <input type="file" multiple accept={ACCEPT_BULK} className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="mt-1 text-xs text-mute">{dict.bulk.artworkHint}</p>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between bg-bone px-3 py-2">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} aria-label={dict.common.delete}><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="b-notes">{dict.bulk.notes} ({dict.common.optional})</label><textarea id="b-notes" name="notes" rows={3} className="field" maxLength={4000} /></div>
      <button disabled={pending || uploading} className="btn btn-primary h-14 sm:col-span-2">{pending ? <Loader2 className="size-4 animate-spin" /> : dict.bulk.submit}</button>
    </form>
  );
}
