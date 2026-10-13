import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !supabaseKey || url.includes("your-project-url")) {
    return new NextResponse(
      "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), then redeploy.",
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }

  const path = request.nextUrl.pathname;
  const isAuthPage = AUTH_PAGES.includes(path);

  if (path.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  // Actions authenticate at the mutation boundary and can write refreshed
  // cookies themselves. Let logout run even with an expired/invalid session.
  if (request.method === "POST" && request.headers.has("next-action")) {
    return NextResponse.next({ request });
  }

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

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
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verified JWT claims avoid a second Auth API round trip before every page.
  // Pages/actions still verify the user, and database reads remain RLS-scoped.
  const { data, error } = await supabase.auth.getClaims();
  const signedIn = !error && Boolean(data?.claims?.sub);

  if (!signedIn && !isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return redirectWithCookies(response, redirectUrl);
  }

  if (signedIn && isAuthPage && request.method === "GET") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return redirectWithCookies(response, redirectUrl);
  }

  return response;
}

/** Preserve a refreshed Supabase session when auth checks also redirect. */
function redirectWithCookies(response: NextResponse, url: URL) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  redirectResponse.headers.set("Cache-Control", "private, no-store");
  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|auth/callback|(?:manifest\\.webmanifest|sw\\.js)$|.*\\.(?:woff2?|png|svg|ico)$).*)",
  ],
};
