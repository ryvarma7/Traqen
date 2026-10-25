/** Safe boundary for server-component/database reads.
 *
 * Supabase errors can contain table names, policy details, or deployment
 * information. Log only a small correlation surface on the server and expose
 * a generic error to the Next error boundary.
 */
export class DataAccessError extends Error {
  constructor() {
    super("Unable to load this page.");
    this.name = "DataAccessError";
  }
}

type QueryError = {
  code?: string | null;
  status?: number | null;
};

export function requireQueryData<T>(
  result: { data: T | null; error: unknown },
  operation: string
): NonNullable<T> {
  if (result.error) {
    const error = result.error as QueryError;
    console.error("[data-access] query failed", {
      operation,
      code: error.code ?? "unknown",
      status: error.status ?? null,
    });
    throw new DataAccessError();
  }

  return result.data as NonNullable<T>;
}

export function requireAuthData(
  result: { data: { user: unknown }; error: unknown },
  operation: string
): { user: unknown } {
  return requireQueryData(result, operation);
}
