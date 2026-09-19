import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase projects created recently use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *  (sb_publishable_…); older ones use NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT). */
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// One shared client for the whole browser session — creating a new
// SupabaseClient on every call wastes allocations and re-initializes fetch.
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey!
    );
  }
  return client;
}
