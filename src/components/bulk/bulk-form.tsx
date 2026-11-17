"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { submitBulkRequest } from "@/lib/actions/bulk";
import { uploadArtwork, ACCEPT_BULK } from "@/lib/upload-client";
import { BULK_PRODUCT_TYPES, BULK_SIZES } from "@/lib/validation";
import { normalizeIraqiPhone } from "@/lib/phone";

export function BulkForm() {
  const { dict } = useI18n();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Record<string, string>>({});

  if (done)
    return (
      <div className="flex flex-col items-center gap-4 border border-ink p-10 text-center">
        <CheckCircle2 className="size-12 text-pine" strokeWidth={1.4} />
        <p className="text-lg font-semibold">{fmt(dict.bulk.success, { n: done })}</p>
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
    for (const k of ["organization_name", "contact_name", "estimated_quantity"]) if (!String(fd.get(k) ?? "").trim()) errs[k] = "required";
    if (!normalizeIraqiPhone(phone)) errs.phone = "phone";
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
        estimated_quantity: fd.get("estimated_quantity"),
        size_breakdown: Object.fromEntries(Object.entries(sizes).filter(([, v]) => v && Number(v) > 0).map(([k, v]) => [k, Number(v)])),
        printing_requirements: fd.get("printing_requirements") || undefined,
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
      <div className="sm:col-span-2"><label className="label" htmlFor="b-org">{dict.bulk.organization}</label><input id="b-org" name="organization_name" className="field" required maxLength={200} aria-invalid={!!errors.organization_name} />{fe("organization_name")}</div>
      <div><label className="label" htmlFor="b-contact">{dict.bulk.contactName}</label><input id="b-contact" name="contact_name" className="field" required autoComplete="name" />{fe("contact_name")}</div>
      <div><label className="label" htmlFor="b-phone">{dict.bulk.phone}</label><input id="b-phone" name="phone" type="tel" dir="ltr" className="field" required placeholder="07xx xxx xxxx" autoComplete="tel" aria-invalid={!!errors.phone} />{fe("phone")}</div>
      <div><label className="label" htmlFor="b-email">{dict.bulk.email} ({dict.common.optional})</label><input id="b-email" name="email" type="email" dir="ltr" className="field" autoComplete="email" />{fe("email")}</div>
      <div>
        <label className="label" htmlFor="b-type">{dict.bulk.productType}</label>
        <select id="b-type" name="product_type" className="field" defaultValue="tshirt">
          {BULK_PRODUCT_TYPES.map((t) => <option key={t} value={t}>{dict.bulk.productTypes[t]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="b-qty">{dict.bulk.estimatedQuantity}</label><input id="b-qty" name="estimated_quantity" type="number" min={1} max={100000} inputMode="numeric" className="field" required aria-invalid={!!errors.estimated_quantity} />{fe("estimated_quantity")}<p className="mt-1 text-xs text-mute">{dict.bulk.minQty}</p></div>
      <fieldset className="sm:col-span-2">
        <legend className="label">{dict.bulk.sizes}</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {BULK_SIZES.map((s) => (
            <label key={s} className="text-center text-xs font-semibold">
              {s}
              <input type="number" min={0} inputMode="numeric" value={sizes[s] ?? ""} onChange={(e) => setSizes((x) => ({ ...x, [s]: e.target.value }))} className="field mt-1 h-10 px-1 text-center" aria-label={`${dict.bulk.sizes} ${s}`} />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-mute">{dict.bulk.sizesHint}</p>
      </fieldset>
      <div className="sm:col-span-2"><label className="label" htmlFor="b-print">{dict.bulk.printing}</label><textarea id="b-print" name="printing_requirements" rows={3} className="field" placeholder={dict.bulk.printingHint} maxLength={4000} /></div>
      <div className="sm:col-span-2">
        <p className="label">{dict.bulk.artwork}</p>
        <label className={`flex cursor-pointer items-center justify-center gap-2 border border-dashed border-ink/40 p-6 text-sm hover:border-ink ${files.length >= 5 || uploading ? "pointer-events-none opacity-50" : ""}`}>
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <FileUp className="size-5" />}
          {dict.bulk.artwork}
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
      <div className="sm:col-span-2"><label className="label" htmlFor="b-notes">{dict.bulk.notes}</label><textarea id="b-notes" name="notes" rows={3} className="field" maxLength={4000} /></div>
      <button disabled={pending || uploading} className="btn btn-primary h-14 sm:col-span-2">{pending ? <Loader2 className="size-4 animate-spin" /> : dict.bulk.submit}</button>
    </form>
  );
}
