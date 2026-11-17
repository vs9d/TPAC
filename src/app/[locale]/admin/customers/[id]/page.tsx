import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { PageHeader, Card, Pill, STATUS_TONE, Stat, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Select, Submit } from "@/components/admin/form";
import { updateCustomer, setRole } from "@/lib/actions/admin/customers";
import { formatIQD, formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import { governorateName } from "@/lib/iraq";
import type { Address, Profile } from "@/lib/types";

export default async function AdminCustomer({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const session = await getSession();
  const { data: profile } = await supabase.from("customer_profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!profile) notFound();
  let ordersQ = supabase.from("orders").select("id, order_number, status, total, created_at").order("created_at", { ascending: false }).limit(100);
  ordersQ = profile.phone ? ordersQ.or(`user_id.eq.${id},phone.eq.${profile.phone}`) : ordersQ.eq("user_id", id);
  const [{ data: orders }, { data: addresses }] = await Promise.all([ordersQ, supabase.from("addresses").select("*").eq("user_id", id)]);
  const valid = (orders ?? []).filter((o) => o.status !== "cancelled");
  const isAdmin = session?.profile?.role === "admin";
  return (
    <div className="space-y-6">
      <PageHeader title={profile.full_name || profile.email || "—"} subtitle={`${profile.email ?? ""} · ${t("منذ", "since")} ${formatDate(profile.created_at, locale)}`} actions={<Pill tone={profile.role === "customer" ? "neutral" : "dark"}>{profile.role}</Pill>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("الطلبات", "Orders")} value={valid.length} />
        <Stat label={t("إجمالي الإنفاق", "Total spent")} value={formatIQD(valid.reduce((n, o) => n + o.total, 0), locale)} />
        <Stat label={t("متوسط الطلب", "Average order")} value={formatIQD(valid.length ? Math.round(valid.reduce((n, o) => n + o.total, 0) / valid.length) : 0, locale)} />
        <Stat label={t("عميل متكرر", "Repeat customer")} value={valid.length >= 2 ? t("نعم", "Yes") : t("لا", "No")} tone={valid.length >= 2 ? "good" : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t("سجل المشتريات", "Purchase history")} className="xl:col-span-2">
          {!orders?.length ? <Empty>—</Empty> : (
            <table className="table-admin"><tbody>
              {orders.map((o) => (
                <tr key={o.id}><td><Link href={`/${locale}/admin/orders/${o.id}`} className="font-semibold hover:underline" dir="ltr">{o.order_number}</Link></td><td><Pill tone={STATUS_TONE[o.status]}>{dict.status[o.status]}</Pill></td><td className="text-xs text-mute">{formatDate(o.created_at, locale)}</td><td className="text-end tabular-nums">{formatIQD(o.total, locale)}</td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <div className="space-y-6">
          <Card title={t("المعلومات", "Details")}>
            {isAdmin ? (
              <AdminForm action={updateCustomer} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Input name="full_name" label={t("الاسم", "Name")} defaultValue={profile.full_name ?? ""} />
                <Input name="phone" label={t("الهاتف", "Phone")} defaultValue={formatIraqiPhone(profile.phone)} dir="ltr" />
                <Submit variant="outline">{t("حفظ", "Save")}</Submit>
              </AdminForm>
            ) : (
              <div className="space-y-1 text-sm"><p>{profile.full_name}</p><p dir="ltr" className="text-start">{formatIraqiPhone(profile.phone)}</p></div>
            )}
          </Card>
          {isAdmin && session?.userId !== id && (
            <Card title={t("الصلاحيات", "Role")}>
              <AdminForm action={setRole} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Select name="role" label={t("الدور", "Role")} defaultValue={profile.role} options={[{ value: "customer", label: t("عميل", "Customer") }, { value: "staff", label: t("موظف (إدارة الطلبات والمنتجات)", "Staff (orders & catalog)") }, { value: "admin", label: t("مدير (كل الصلاحيات)", "Admin (full access)") }]} />
                <Submit variant="outline">{t("تحديث الدور", "Update role")}</Submit>
              </AdminForm>
            </Card>
          )}
          <Card title={t("العناوين", "Addresses")}>
            {!addresses?.length ? <Empty>—</Empty> : (
              <ul className="space-y-3 text-sm">{(addresses as Address[]).map((a) => <li key={a.id}><p className="font-semibold">{a.label || a.city} {a.is_default && <Pill>✓</Pill>}</p><p className="text-mute">{governorateName(a.governorate, locale)} — {a.city} — {a.address_line}</p></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
