import { createBrowserClient } from "@supabase/ssr";

/** Supabase projects created recently use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *  (sb_publishable_…); older ones use NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT). */
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!
  );
}
