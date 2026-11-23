import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const PORTFOLIO_CATEGORIES = ["university", "college", "company", "organization", "custom"] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<PortfolioCategory, { ar: string; en: string }> = {
  university: { ar: "جامعات", en: "Universities" },
  college: { ar: "كليات", en: "Colleges" },
  company: { ar: "شركات", en: "Companies" },
  organization: { ar: "منظمات", en: "Organizations" },
  custom: { ar: "طلبات خاصة", en: "Custom orders" },
};

export interface PortfolioClient { id: string; name_ar: string; name_en: string | null; category: PortfolioCategory; logo_url: string | null; logo_path: string | null; sort_order: number; is_active: boolean }
export interface PortfolioPhoto { url: string; path?: string | null }
export interface PortfolioProject {
  id: string; client_id: string | null; title_ar: string; title_en: string | null; description_ar: string | null; description_en: string | null;
  category: PortfolioCategory; photos: PortfolioPhoto[]; completed_on: string | null; is_featured: boolean; sort_order: number; is_active: boolean;
  client?: PortfolioClient | null;
}

/** Only what the admin uploaded and switched on (RLS hides inactive rows from the public). Empty before add-business-features.sql. */
export const getPortfolio = cache(async (): Promise<{ clients: PortfolioClient[]; projects: PortfolioProject[] }> => {
  if (!isSupabaseConfigured()) return { clients: [], projects: [] };
  const supabase = await createClient();
  const [{ data: clients, error }, { data: projects }] = await Promise.all([
    supabase.from("portfolio_clients").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    supabase.from("portfolio_projects").select("*, client:portfolio_clients(*)").eq("is_active", true).order("is_featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false }),
  ]);
  if (error) return { clients: [], projects: [] };
  return { clients: (clients as PortfolioClient[]) ?? [], projects: (projects as PortfolioProject[]) ?? [] };
});

export const getProject = cache(async (id: string): Promise<PortfolioProject | null> => {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("portfolio_projects").select("*, client:portfolio_clients(*)").eq("id", id).eq("is_active", true).maybeSingle();
  return (data as PortfolioProject | null) ?? null;
});
