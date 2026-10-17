# Traqen

Personal productivity dashboard for applications, hackathons, tasks, notes,
calendar events, and learning tracks. Next.js App Router, React, Tailwind CSS,
Framer Motion, and Supabase.

## Setup and run

1. Install Node **26.2.0** (pinned in `.nvmrc`). With nvm on Linux/macOS:
   `nvm install && nvm use`. On Windows, select that version with your Node manager.
2. Run `npm ci` in the repository root. Keep `package-lock.json` checked in.
3. Copy `.env.example` to `.env.local` and supply your own Supabase public URL,
   publishable key, and site URL. Never commit `.env.local` or service-role keys.
4. For a new Supabase project, run `supabase/schema.sql` in its SQL editor.
   Existing deployments use the applicable incremental SQL files in `supabase/`.
   Enable Google OAuth and allow `<site-url>/auth/callback` in its redirect URLs.
5. Run `npm run dev`; open **http://localhost:3000**.

For production locally, run `npm run build`, then `npm start`. The build downloads
the Raleway font through `next/font/google` and therefore needs network access.

## Checks

The portable, offline performance regression command (after `npm ci`) is:

```sh
node --test tests/performance.test.cjs
```

Also run `npm run lint`, `npx --no-install tsc --noEmit --incremental false`, and
`npm run build` before deploying. Unit tests validate frame-event coalescing,
bounded entrance timing, and the unchanged contour geometry/brightness.

Optional browser regression and measurements, using an installed Chrome/Chromium:

```sh
node tests/performance/browser.cjs
node tests/performance/browser.cjs --baseline 90a8fda
node tests/performance/contour-benchmark.cjs
```

Set `CHROME_PATH` if the browser is not found automatically. `PERF_TEMP_DIR` can
choose an existing temporary directory. The browser runner bundles real UI with
synthetic data and mocked router/network boundaries on a loopback-only server.
It never signs in or writes to Supabase. It checks desktop/mobile layouts,
note typing, calendar selection, reduced motion, and sampled scroll frame times.
It is not a substitute for real-device or authenticated end-to-end testing.

See [`docs/performance.md`](docs/performance.md) for the workload, measured
before/after results, and limitations.

## Deploy

### Vercel

Import the GitHub repository as a Next.js project. Set the three public variables
from `.env.example`, set `NEXT_PUBLIC_SITE_URL` to the deployment's HTTPS origin,
and add that origin's `/auth/callback` URL to Supabase's redirect allowlist. Build
with `npm run build`. Use the pinned Node version if supported by your host;
otherwise verify the host's supported runtime with the checks above before release.

### Docker / clean Linux

Use public configuration values as build arguments, **never** OAuth secrets or
Supabase service-role keys. `NEXT_PUBLIC_*` values are embedded in client bundles.
For example, after exporting your own public configuration:

```sh
docker build -t traqen \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" .
docker run --rm -p 3000:3000 --env-file .env.local traqen
```

The Docker build installs dependencies, runs the offline regressions, builds the
app, and removes development dependencies. The runtime runs as a non-root user.
The runtime environment's Supabase origin must match the build-time origin so
the Content Security Policy and embedded public configuration stay aligned.
