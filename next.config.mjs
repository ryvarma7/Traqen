/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// The Supabase project origin is the only third-party endpoint the app talks
// to (auth + PostgREST over fetch, plus its realtime websocket). Deriving it
// from the env var keeps the policy correct across projects instead of
// hardcoding a project ref.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
try {
  supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
} catch {
  supabaseOrigin = "";
}

const connectSrc = ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])];
if (supabaseOrigin) {
  // Realtime upgrades to wss:// on the same host.
  connectSrc.push(`wss://${supabaseOrigin.replace(/^https:\/\//, "")}`);
}

// 'unsafe-inline' is required in script-src: Next.js inlines bootstrap and
// hydration payloads. 'unsafe-eval' is dev-only (React Refresh / HMR).
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
];

const csp = [
  "default-src 'self'",
  // Inline styles are unavoidable here: Framer Motion animates via the style
  // attribute, and Next.js injects critical CSS as a <style> tag.
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSrc.join(" ")}`,
  `connect-src ${connectSrc.join(" ")}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The service worker is served from the origin root; blob: covers the
  // registration worker on some mobile browsers.
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Only same-origin form posts (the server-action endpoints). Blocks
  // form-action hijacking to an attacker's origin.
  "form-action 'self'",
  // No iframes at all; keeps parity with X-Frame-Options: DENY.
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // HSTS is meaningless over plain http, so it's omitted in dev where
        // NEXT_PUBLIC_SITE_URL is http://localhost — a stray header there
        // would just be noise, and pinning localhost to HTTPS would break it.
        ...(isDev ? [] : [{
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        }]),
      ],
    }];
  },
  experimental: {
    // Cache Router data payloads so repeat/back-forward navigation is instant.
    // Server actions call revalidatePath, which busts this cache on writes.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
