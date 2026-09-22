import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth code exchange — Supabase redirects here after Google sign-in.
 *  Must stay outside the auth middleware matcher: at this point the
 *  session cookie does not exist yet, so the middleware would bounce the
 *  request to /login and the code would expire unused.
 *  The code is single-use; any failure sends the user back to /login
 *  with an error= query param instead of throwing. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // First-ever sign-in: create the profiles row (username derived from
      // the Google account, uniqueness enforced). Returns null when the
      // profile already exists. The real Google email stays inside
      // auth.users and is never surfaced in the UI.
      const { error: profileError } = await supabase.rpc("ensure_profile");
      if (!profileError) return NextResponse.redirect(origin);
    }
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "Google sign-in did not complete. Try again.");
  return NextResponse.redirect(failed);
}