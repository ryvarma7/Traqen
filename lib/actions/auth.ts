"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AuthResult = { error?: string } | undefined;

/** Signup: username + password only. The real Supabase email is generated
 *  internally and never shown in the UI. */
export async function signUp(
  username: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();
  const uname = username.trim().toLowerCase();
  const email = `${uname}@traqen.local`;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Something went wrong creating your account." };

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    username: uname,
    email_internal: email,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  redirect("/");
}

/** Login: resolve username -> internal email via the SECURITY DEFINER RPC,
 *  then sign in with password. The RPC never exposes the profiles table. */
export async function logIn(
  username: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();
  const uname = username.trim().toLowerCase();

  const { data: email, error: rpcError } = await supabase.rpc(
    "get_email_for_username",
    { uname }
  );
  if (rpcError || !email) {
    return { error: "Invalid username or password." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid username or password." };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logOut(): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/login");
}
