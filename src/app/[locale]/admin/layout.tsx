import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";
import { InstallPrompt, InstallSettings } from "@/components/pwa/install";
import { getSettings } from "@/lib/data/content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TPAC Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireStaff(locale);
  const supabase = await createClient();
  const [{ count: unread }, { count: newBulk }, { count: newOrders }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("audience", "admin").eq("channel", "in_app").is("read_at", null),
    supabase.from("bulk_order_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "received"),
  ]);
  return (
    <AdminShell role={session.profile!.role} name={session.profile?.full_name ?? session.email ?? ""} badges={{ notifications: unread ?? 0, bulk: newBulk ?? 0, orders: newOrders ?? 0 }}>
      <InstallSettings enabled={(await getSettings()).app?.show_install === true}>
        {children}
        <InstallPrompt />
      </InstallSettings>
    </AdminShell>
  );
}
