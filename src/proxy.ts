import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/public-routes";

// Refreshes the Supabase session cookie and sends signed-out visitors to /login (except the public read-only routes).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search, searchParams } = request.nextUrl;
  if (!user && !pathname.startsWith("/login") && !isPublicPath(pathname, searchParams)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // icon/apple-icon are Next's generated-icon routes (app/icon.tsx, app/apple-icon.tsx) -
  // they have no file extension in the URL, so the image-extension exclusion below misses them.
  // api/keep-alive and api/reminders are called by Vercel Cron without a login (see those routes). The manifest, app icons,
  // service worker and offline page must load signed out too, or the app can't be installed.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|api/keep-alive$|api/reminders$|manifest.webmanifest$|app-icons/|sw\\.js$|offline\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
