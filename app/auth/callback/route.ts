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
  const origin = getSiteUrl(requestUrl.origin);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // First-ever sign-in: create the profiles row (username derived from
      // the Google account, uniqueness enforced). Returns null when the
      // profile already exists. The real Google email stays inside
      // auth.users and is never surfaced in the UI.
      // Provisioning is best-effort: a missing/out-of-date migration must not
      // strand a user after Google has already authenticated them.
      await supabase.rpc("ensure_profile");
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "Google sign-in did not complete. Try again.");
  return NextResponse.redirect(failed);
}
