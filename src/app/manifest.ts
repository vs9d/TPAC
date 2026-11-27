import type { MetadataRoute } from "next";

/** The installable app: opens full-screen from the home screen, with shortcuts on a long press of the icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ar",
    name: "TPAC — Iraqi Streetwear",
    short_name: "TPAC",
    description: "ستريت وير عراقي بهوية عربية — اطلب، صمّم، وتابع طلباتك",
    start_url: "/ar?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#fbfaf7",
    theme_color: "#376352",
    lang: "ar",
    dir: "rtl",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "صمّم قطعتك", short_name: "صمّم", url: "/ar/design?source=app", icons: [{ src: "/brand/icon-96.png", sizes: "96x96" }] },
      { name: "تتبّع طلبك", short_name: "تتبّع", url: "/ar/track?source=app", icons: [{ src: "/brand/icon-96.png", sizes: "96x96" }] },
      { name: "السلة", short_name: "السلة", url: "/ar/cart?source=app", icons: [{ src: "/brand/icon-96.png", sizes: "96x96" }] },
      { name: "حسابي", short_name: "حسابي", url: "/ar/account?source=app", icons: [{ src: "/brand/icon-96.png", sizes: "96x96" }] },
    ],
  };
}
