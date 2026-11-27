import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabase = supabaseUrl && !supabaseUrl.includes("YOUR-PROJECT") ? new URL(supabaseUrl) : undefined;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 80, 90],
    remotePatterns: supabase
      ? [{ protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, port: supabase.port, pathname: "/storage/v1/object/public/**" }]
      : [],
    // Only for local end-to-end testing against the emulator on localhost.
    dangerouslyAllowLocalIP: process.env.ALLOW_LOCAL_IMAGES === "1",
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // the app's service worker: always re-checked, so an update reaches every installed phone
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  async redirects() {
    // designs.thetpac.com (any path) → the print studio on the main domain.
    // Temporary (307) on purpose, so the target can change later without browsers remembering the old one.
    return [{ source: "/:path*", has: [{ type: "host", value: "designs.thetpac.com" }], destination: "https://thetpac.com/ar/design", permanent: false }];
  },
};

export default nextConfig;
