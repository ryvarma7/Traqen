import type { SupabaseClient } from "@supabase/supabase-js";

/** Recover an authenticated account whose first-login provisioning failed. */
export async function readProfile(supabase: SupabaseClient, userId: string) {
  const read = () => supabase.from("profiles")
    .select("username, preferences").eq("id", userId).maybeSingle();

  const result = await read();
  if (result.error || result.data) return result;

  const { error } = await supabase.rpc("ensure_profile");
  if (error) return { data: null, error };
  return read();
}
