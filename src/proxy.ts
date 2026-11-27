import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

/**
 * 1. Redirects locale-less URLs to /ar (default) or the visitor's saved locale.
 * 2. Refreshes the Supabase auth session cookie on every navigation.
 * Authorisation itself is enforced in pages/actions and by RLS — never only here.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (!isLocale(first)) {
    const saved = request.cookies.get("tpac_locale")?.value;
    const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  if (first !== request.cookies.get("tpac_locale")?.value) {
    response.cookies.set("tpac_locale", first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && !url.includes("YOUR-PROJECT")) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const locale = response.cookies.get("tpac_locale");
          response = NextResponse.next({ request });
          if (locale) response.cookies.set(locale);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    try {
      await supabase.auth.getUser();
    } catch {
      // network hiccup: continue without refreshing
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|products|favicon|icon|apple-icon|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|mp4|webm|mov|woff2?)$).*)"],
};
