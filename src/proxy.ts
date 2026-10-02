import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and sends signed-out visitors to /login.
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

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // icon/apple-icon are Next's generated-icon routes (app/icon.tsx, app/apple-icon.tsx) -
  // they have no file extension in the URL, so the image-extension exclusion below misses them.
  // api/keep-alive is called by Vercel Cron without a login (see that route). The manifest, app icons,
  // service worker and offline page must load signed out too, or the app can't be installed.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|api/keep-alive$|manifest.webmanifest$|app-icons/|sw\\.js$|offline\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
