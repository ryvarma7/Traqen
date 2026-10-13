"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

type AuthResult = { error?: string } | undefined;

/** Google is the only sign-in method. Handshake is finished in
 *  /auth/callback (the route receives the code from Google's redirect);
 *  this action just redirects the browser to Supabase's hosted consent
 *  screen and never sees a password. */
export async function logInWithGoogle(): Promise<AuthResult> {
  const supabase = await createClient();
  const authBaseUrl = getSiteUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${authBaseUrl}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  redirect(data.url);
}

export async function logOut(): Promise<AuthResult> {
  const supabase = await createClient();
  // Local scope clears this browser's session without waiting for a global
  // token-revocation request. The cookie is the session boundary for this app.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  // The caller performs the final navigation after the action response applies
  // the cleared cookies. Returning normally also lets the menu surface errors
  // instead of leaving a rejected fire-and-forget action behind.
  return {};
}
