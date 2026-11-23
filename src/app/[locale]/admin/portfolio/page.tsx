import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Star } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Select, Textarea, Checkbox, Submit } from "@/components/admin/form";
import { ImageField } from "@/components/admin/image-field";
import { PhotosField } from "@/components/admin/portfolio/photos-field";
import { savePortfolioClient, deletePortfolioClient, savePortfolioProject, deletePortfolioProject, movePortfolioItem } from "@/lib/actions/admin/portfolio";
import { CATEGORY_LABEL, PORTFOLIO_CATEGORIES, type PortfolioClient, type PortfolioProject } from "@/lib/data/portfolio";

export default async function AdminPortfolio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: c, error }, { data: p }] = await Promise.all([
    supabase.from("portfolio_clients").select("*").order("sort_order").order("created_at"),
    supabase.from("portfolio_projects").select("*").order("sort_order").order("created_at", { ascending: false }),
  ]);
  const clients = (c as PortfolioClient[]) ?? [];
  const projects = (p as PortfolioProject[]) ?? [];
  const cats = PORTFOLIO_CATEGORIES.map((k) => ({ value: k, label: locale === "ar" ? CATEGORY_LABEL[k].ar : CATEGORY_LABEL[k].en }));
  const name = (x: PortfolioClient) => (locale === "ar" ? x.name_ar : x.name_en ?? x.name_ar);

  if (error) return (
    <div className="space-y-6">
      <PageHeader title={t("أعمالنا والعملاء السابقين", "Portfolio & clients")} />
      <Card><p className="text-sm">{t("شغّل ملف supabase/add-business-features.sql بـ SQL Editor حتى يشتغل هذا القسم.", "Run supabase/add-business-features.sql in the SQL Editor to enable this section.")}</p></Card>
    </div>
  );

  const clientFields = (x?: PortfolioClient) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {x && <input type="hidden" name="id" value={x.id} />}
      <Input name="name_ar" id={x ? `c-ar-${x.id}` : "c-ar-new"} label={t("الاسم", "Name (Arabic)")} defaultValue={x?.name_ar} required />
      <Input name="name_en" id={x ? `c-en-${x.id}` : "c-en-new"} label={t("الاسم بالإنجليزي", "Name (English)")} defaultValue={x?.name_en ?? ""} dir="ltr" />
      <Select name="category" id={x ? `c-cat-${x.id}` : "c-cat-new"} label={t("التصنيف", "Category")} defaultValue={x?.category ?? "university"} options={cats} />
      <Input name="sort_order" id={x ? `c-so-${x.id}` : "c-so-new"} type="number" label={t("الترتيب", "Order")} defaultValue={x?.sort_order ?? clients.length + 1} />
      <ImageField name="logo_url" folder="portfolio/logos" transparent label={t("الشعار (PNG شفاف أفضل)", "Logo (transparent PNG is best)")} defaultValue={x?.logo_url} className="sm:col-span-2" />
      <Checkbox name="is_active" label={t("ظاهر بالموقع", "Shown on the site")} defaultChecked={x?.is_active ?? true} />
    </div>
  );

  const projectFields = (x?: PortfolioProject) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {x && <input type="hidden" name="id" value={x.id} />}
      <Input name="title_ar" id={x ? `p-ar-${x.id}` : "p-ar-new"} label={t("عنوان المشروع", "Project title (Arabic)")} defaultValue={x?.title_ar} required />
      <Input name="title_en" id={x ? `p-en-${x.id}` : "p-en-new"} label={t("العنوان بالإنجليزي", "Title (English)")} defaultValue={x?.title_en ?? ""} dir="ltr" />
      <Select name="client_id" id={x ? `p-cl-${x.id}` : "p-cl-new"} label={t("الجهة / الجامعة", "Organisation / university")} defaultValue={x?.client_id ?? ""} options={[{ value: "", label: "—" }, ...clients.map((k) => ({ value: k.id, label: name(k) }))]} />
      <Select name="category" id={x ? `p-cat-${x.id}` : "p-cat-new"} label={t("التصنيف", "Category")} defaultValue={x?.category ?? "university"} options={cats} />
      <Textarea name="description_ar" id={x ? `p-dar-${x.id}` : "p-dar-new"} label={t("وصف قصير", "Short description (Arabic)")} defaultValue={x?.description_ar ?? ""} rows={3} />
      <Textarea name="description_en" id={x ? `p-den-${x.id}` : "p-den-new"} label={t("الوصف بالإنجليزي", "Description (English)")} defaultValue={x?.description_en ?? ""} rows={3} dir="ltr" />
      <Input name="completed_on" id={x ? `p-dt-${x.id}` : "p-dt-new"} type="date" label={t("تاريخ الإنجاز (اختياري)", "Completed on (optional)")} defaultValue={x?.completed_on ?? ""} />
      <Input name="sort_order" id={x ? `p-so-${x.id}` : "p-so-new"} type="number" label={t("الترتيب", "Order")} defaultValue={x?.sort_order ?? projects.length + 1} />
      <div className="sm:col-span-2"><PhotosField initial={x?.photos ?? []} /></div>
      <Checkbox name="is_featured" label={t("مشروع مميّز (يطلع أول)", "Featured (shown first)")} defaultChecked={x?.is_featured ?? false} />
      <Checkbox name="is_active" label={t("ظاهر بالموقع", "Shown on the site")} defaultChecked={x?.is_active ?? true} />
    </div>
  );

  const Move = ({ table, id }: { table: "clients" | "projects"; id: string }) => (
    <span className="flex gap-1">
      {(["up", "down"] as const).map((dir) => (
        <AdminForm key={dir} action={movePortfolioItem}>
          <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="dir" value={dir} />
          <button className="grid size-8 place-items-center rounded-full border border-line hover:bg-bone" aria-label={dir === "up" ? t("لفوق", "Move up") : t("لجوه", "Move down")}>{dir === "up" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}</button>
        </AdminForm>
      ))}
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("أعمالنا والعملاء السابقين", "Portfolio & clients")}
        subtitle={t("يظهر بالموقع فقط اللي ترفعه وتفعّله انت — بدون أسماء أو صور وهمية.", "Only what you upload and switch on is shown — no made-up names or photos.")}
        actions={<a href={`/${locale}/portfolio`} target="_blank" className="btn btn-outline btn-sm"><ExternalLink className="size-4" /> {t("عرض الصفحة", "View page")}</a>}
      />

      <Card title={`${t("العملاء والشعارات", "Clients & logos")} (${clients.length})`}>
        <div className="space-y-3">
          {!clients.length && <Empty>{t("ما أضفت عملاء بعد.", "No clients yet.")}</Empty>}
          {clients.map((x) => (
            <details key={x.id} className="rounded-2xl border border-line">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.logo_url ? <img src={x.logo_url} alt="" className="h-9 w-16 object-contain dark:invert" /> : <span className="grid h-9 w-16 place-items-center rounded bg-bone text-[10px] text-mute">—</span>}
                <span className="flex-1 text-sm font-semibold">{name(x)}</span>
                <Pill>{locale === "ar" ? CATEGORY_LABEL[x.category].ar : CATEGORY_LABEL[x.category].en}</Pill>
                <Pill tone={x.is_active ? "good" : "neutral"}>{x.is_active ? t("ظاهر", "Shown") : t("مخفي", "Hidden")}</Pill>
                <Move table="clients" id={x.id} />
              </summary>
              <div className="border-t border-line p-4">
                <AdminForm action={savePortfolioClient} className="space-y-3">{clientFields(x)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
                <AdminForm action={deletePortfolioClient} className="mt-3"><input type="hidden" name="id" value={x.id} /><button className="text-xs text-danger underline">{t("حذف العميل", "Delete client")}</button></AdminForm>
              </div>
            </details>
          ))}
          <AdminForm action={savePortfolioClient} resetOnSuccess className="space-y-3 rounded-2xl bg-bone p-4">
            <p className="text-sm font-bold">{t("عميل جديد", "New client")}</p>
            {clientFields()}
            <Submit>{t("إضافة", "Add")}</Submit>
          </AdminForm>
        </div>
      </Card>

      <Card title={`${t("المشاريع", "Projects")} (${projects.length})`}>
        <div className="space-y-3">
          {!projects.length && <Empty>{t("ما أضفت مشاريع بعد.", "No projects yet.")}</Empty>}
          {projects.map((x) => (
            <details key={x.id} className="rounded-2xl border border-line">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.photos[0] ? <img src={x.photos[0].url} alt="" className="size-12 rounded-lg object-cover" /> : <span className="grid size-12 place-items-center rounded-lg bg-bone text-[10px] text-mute">—</span>}
                <span className="flex-1 text-sm font-semibold">{locale === "ar" ? x.title_ar : x.title_en ?? x.title_ar} <span className="text-xs font-normal text-mute">· {x.photos.length} {t("صورة", "photos")}</span></span>
                {x.is_featured && <Star className="size-4 fill-amber text-amber" aria-label={t("مميّز", "Featured")} />}
                <Pill tone={x.is_active ? "good" : "neutral"}>{x.is_active ? t("ظاهر", "Shown") : t("مخفي", "Hidden")}</Pill>
                <Move table="projects" id={x.id} />
              </summary>
              <div className="border-t border-line p-4">
                <AdminForm action={savePortfolioProject} className="space-y-3">{projectFields(x)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
                <AdminForm action={deletePortfolioProject} className="mt-3"><input type="hidden" name="id" value={x.id} /><button className="text-xs text-danger underline">{t("حذف المشروع", "Delete project")}</button></AdminForm>
              </div>
            </details>
          ))}
          <AdminForm action={savePortfolioProject} resetOnSuccess className="space-y-3 rounded-2xl bg-bone p-4">
            <p className="text-sm font-bold">{t("مشروع جديد", "New project")}</p>
            {projectFields()}
            <Submit>{t("إضافة", "Add")}</Submit>
          </AdminForm>
        </div>
      </Card>
    </div>
  );
}
