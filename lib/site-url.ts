function normalizeOrigin(value: string, allowHttp: boolean): string | null {
  try {
    const url = new URL(value);
    const localHttp = allowHttp && url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:") && !localHttp) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (configured) {
    const origin = normalizeOrigin(configured, !isProduction);
    if (origin) return origin;
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid HTTPS origin in production.");
  }

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && productionUrl) {
    const origin = normalizeOrigin(`https://${productionUrl.replace(/^https?:\/\//, "")}`, false);
    if (origin) return origin;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const origin = normalizeOrigin(`https://${vercelUrl.replace(/^https?:\/\//, "")}`, false);
    if (origin) return origin;
  }

  // Never derive an OAuth redirect from Host in production. A misconfigured
  // deployment should fail closed instead of becoming an open redirect.
  if (isProduction) throw new Error("A production site URL is not configured.");

  return normalizeOrigin(requestOrigin ?? "http://localhost:3000", true) ?? "http://localhost:3000";
}
