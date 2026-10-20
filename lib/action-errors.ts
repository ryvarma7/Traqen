/**
 * Server actions must not send Supabase/Postgres error text to the browser.
 * Provider messages can expose table names, constraint names, or deployment
 * details. Keep the client-facing result stable and intentionally generic.
 */
export function safeActionError(_error: unknown, fallback: string): string {
  return fallback;
}
