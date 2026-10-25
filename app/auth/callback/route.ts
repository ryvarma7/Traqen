import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/** OAuth code exchange — Supabase redirects here after Google sign-in.
 *  Must stay outside the auth middleware matcher: at this point the
 *  session cookie does not exist yet, so the middleware would bounce the
 *  request to /login and the code would expire unused.
 *  The code is single-use; any failure sends the user back to /login
 *  with an error= query param instead of throwing. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  let origin: string;
  try {
    origin = getSiteUrl(requestUrl.origin);
  } catch {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // First-ever sign-in: create the profiles row (username derived from
      // the Google account, uniqueness enforced). Returns null when the
      // profile already exists. The real Google email stays inside
      // auth.users and is never surfaced in the UI.
      const { error: profileError } = await supabase.rpc("ensure_profile");
      if (profileError) {
        // Do not leave an authenticated session without its profile row: the
        // dashboard cannot rename or address that account reliably.
        console.error("[auth/callback] profile provisioning failed:", profileError.code);
        await supabase.auth.signOut({ scope: "local" });
        const failed = new URL("/login", origin);
        failed.searchParams.set("error", "Your account could not be set up. Please try again.");
        return NextResponse.redirect(failed);
      }
      // justSignedIn=1 triggers the post-login loading overlay on the hub.
      const home = new URL("/", origin);
      home.searchParams.set("justSignedIn", "1");
      return NextResponse.redirect(home);
    }
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "Google sign-in did not complete. Try again.");
  return NextResponse.redirect(failed);
}
