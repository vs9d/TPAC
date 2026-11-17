/** Public (browser-safe) configuration. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function isSupabaseConfigured(): boolean {
  return (
    publicEnv.supabaseUrl.startsWith("https://") || publicEnv.supabaseUrl.startsWith("http://")
  ) && !publicEnv.supabaseUrl.includes("YOUR-PROJECT") && publicEnv.supabaseAnonKey.length > 20;
}
