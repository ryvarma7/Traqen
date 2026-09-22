import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// /signup just redirects to /login; keeping it here stops the middleware
// from bouncing a signed-in user into a redirect loop.
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Newer Supabase projects use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // (sb_publishable_…); older ones use NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT).
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials we can't talk to Supabase. Return a clear message
  // instead of letting createServerClient throw and crash the middleware
  // (happens when env vars are missing or still placeholders on the host).
  if (!url || !supabaseKey || url.includes("your-project-url")) {
    return new NextResponse(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), then redeploy.",
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }

  const path = request.nextUrl.pathname;
  const isAuthPage = AUTH_PAGES.includes(path);

  // The OAuth code exchange lands here with no session cookie yet; let it
  // through untouched or the code would expire while we redirect to /login.
  if (path.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  // Fast path: no session cookie means there is nothing to refresh at
  // Supabase, so skip the auth round-trip entirely. Note: @supabase/ssr
  // chunks oversized sessions as sb-<ref>-auth-token.0/.1/…, so match on
  // includes("auth-token") — endsWith would miss chunked sessions and
  // bounce a freshly signed-in user straight back to /login.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasSessionCookie) {
    if (isAuthPage) return NextResponse.next({ request });
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Recreate the response so refreshed session cookies are propagated.
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshes the session server-side; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // manifest.webmanifest and sw.js must stay public: the browser fetches them
  // without a session when checking PWA installability, so auth-redirecting
  // them makes Chrome report "This app cannot be installed".
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|(?:manifest\\.webmanifest|sw\\.js)$|.*\\.(?:woff2?|png|svg|ico)$).*)",
  ],
};
