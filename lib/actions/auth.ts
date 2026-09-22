"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AuthResult = { error?: string } | undefined;

function getAuthBaseUrl() {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (process.env.VERCEL_ENV === "production") {
    if (vercelProductionUrl) return `https://${vercelProductionUrl.replace(/^https?:\/\//, "")}`;
    if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/$/, "");

  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return "http://localhost:3000";
}

/** Google is the only sign-in method. Handshake is finished in
 *  /auth/callback (the route receives the code from Google's redirect);
 *  this action just redirects the browser to Supabase's hosted consent
 *  screen and never sees a password. */
export async function logInWithGoogle(): Promise<AuthResult> {
  const supabase = createClient();
  const authBaseUrl = getAuthBaseUrl();

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
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/login");
}