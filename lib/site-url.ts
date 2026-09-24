export function getSiteUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && productionUrl) {
    return `https://${productionUrl.replace(/^https?:\/\//, "")}`;
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return requestOrigin?.replace(/\/$/, "") || "http://localhost:3000";
}
