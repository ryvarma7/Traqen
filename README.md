# Traqen

Personal productivity dashboard for applications, hackathons, tasks, notes,
calendar events, and learning tracks. Next.js App Router, React, Tailwind CSS,
Framer Motion, and Supabase.

## Setup and run

1. Install Node **26.2.0** (pinned in `.nvmrc`). With nvm on Linux/macOS:
   `nvm install && nvm use`. On Windows, select that version with your Node manager.
2. Run `npm ci` in the repository root. Keep `package-lock.json` checked in.
3. Copy `.env.example` to `.env.local` and supply your own Supabase public URL,
   publishable key, site URL, server-only learning-plan provider key, and the
   exact provider model ID enabled for your account. `NVIDIA_API_KEY` and
   `NVIDIA_MODEL` are server-only runtime variables: never prefix them with
   `NEXT_PUBLIC_`, expose them to browser code, or commit `.env.local`.
4. For a new Supabase project, run `supabase/schema.sql` in its SQL editor.
   Existing Traqen deployments run `supabase/schema-migrations.sql` once after
   the canonical schema. Do not choose between historical version files.
   Enable Google OAuth and allow `<site-url>/auth/callback` in its redirect URLs.
5. Run `npm run dev`; open **http://localhost:3000**.

For production locally, run `npm run build`, then `npm start`. The build downloads
the Raleway font through `next/font/google` and therefore needs network access.

### Learning-plan provider (NVIDIA NIM / Nemotron)

The learning-plan generator calls the OpenAI-compatible NVIDIA NIM
chat-completions endpoint (`https://integrate.api.nvidia.com/v1/chat/completions`)
with the server-only `NVIDIA_API_KEY` and the model id in `NVIDIA_MODEL`
(`nvidia/nemotron-3-ultra-550b-a55b` by default). Get a key from
[build.nvidia.com/settings/api-keys](https://build.nvidia.com/settings/api-keys).

- **The reasoning trace is on.** `chat_template_kwargs.enable_thinking` is
  `true`: Nemotron 3 writes a reasoning trace first and returns it in its own
  field (`reasoning_content`), so the answer in `content` stays clean JSON.
  Reasoning tokens are billed against `max_tokens`, so the output budget is
  16,384 tokens. Set `NVIDIA_THINKING=off` to trade the reasoning for a
  faster, smaller answer.
- **Reasoning effort is tunable.** `chat_template_kwargs.medium_effort` and
  `low_effort` ask for fewer reasoning tokens; `NVIDIA_THINKING_EFFORT` sets
  it to `full` (default), `medium` or `low`.
- **Do not send `force_nonempty_content`.** It stops the model returning an
  empty answer when the reasoning phase used up the budget, but it also makes
  the model fold the reasoning into the answer, which in JSON mode shows up as
  a stray `"thinking"` key next to the plan.
- **Sampling follows NVIDIA's guidance** for the Nemotron 3 family:
  `temperature: 1.0`, `top_p: 0.95`.
- **JSON mode** (`response_format: {"type": "json_object"}`) keeps the answer
  parseable. If a deployment rejects guided decoding or the optional chat
  template flags, the client detects the rejection and retries with a simpler
  payload instead of failing.
- **The contract travels in the system message** (curriculum rules, schedule
  context, schema and a format example), while the user's own text travels in
  the user message as untrusted plain text.
- **A plan is generated in two stages.** The *outline* is one reasoned call
  that decides the whole course — its title, its phases, and every step's
  title, objective and date. The *enrichment* is one small call per phase,
  written with the reasoning off, that expands each objective into the full
  why/what/done/check instruction and attaches a resource. The phases are
  independent, so they run concurrently.
  Splitting it this way is what makes a much bigger plan affordable: the
  outline's answer is small (one short objective per step) and the expensive
  per-step prose is written in small, parallel, single-phase calls instead of
  one enormous call that would run out of time.
- **How big a plan gets is set by the window.** `lib/tracks/outline.ts` scales
  the phase and step counts to the number of days available — up to 36 steps
  for a long course, against the 16 the old single-stage contract asked for.
  The ceiling is a time budget, not a taste decision: every step costs answer
  tokens, and the outline shares its output budget with its own reasoning.
- **The compact retry** re-asks the outline with a smaller plan and the
  reasoning trace off, for the case where the first answer was truncated,
  missed the contract, or ran long.
- **A failed enrichment costs detail, not the plan.** The enrichment can only
  add a description and a resource; it can never move a step, rename it or
  change its date. A phase whose enrichment fails keeps the outline's
  objective as its step descriptions, so the plan is always complete.
- The three stages share the 240 seconds the Tracks action is allowed: 160 s
  for the outline, 30 s for the compact retry, 30 s for the enrichment.
- `NVIDIA_BASE_URL` is optional and overrides the API origin, for example
  `http://localhost:8000/v1` for a self-hosted NIM.

To see the exact request that goes over the wire (system message, user message
and the full JSON body) with test data, without a key or a network call:

```sh
npm run preview:plan
```

To check the prompt against the live API and see how often the answer passes
the contract:

```sh
node scripts/smoke-plan-repeat.cjs 3
```

## Checks

The portable, offline regression command (after `npm ci`) is:

```sh
npm test
```

The suite validates frame-event coalescing, bounded entrance timing, unchanged
contour geometry/brightness, and the attention queue's responsive contracts.
Also run `npm run lint`, `npx --no-install tsc --noEmit --incremental false`,
and `npm run build` before deploying.

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
and add that origin's `/auth/callback` URL to Supabase's redirect allowlist. Also
set `NVIDIA_API_KEY` and `NVIDIA_MODEL` as private runtime environment variables
in Vercel; do not add either one to a `NEXT_PUBLIC_*` variable. Build with
`npm run build`. Use the pinned Node version if supported by your host;
otherwise verify the host's supported runtime with the checks above before release.
Learning-plan generation allows up to 240 seconds for the Tracks page action;
confirm your Vercel plan supports that function duration.

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

The private provider variables are read only at runtime by the server action;
they are not Docker build arguments and are never embedded in the browser bundle.

The Docker build installs dependencies, runs the offline regressions, builds the
app, and removes development dependencies. The runtime runs as a non-root user.
The runtime environment's Supabase origin must match the build-time origin so
the Content Security Policy and embedded public configuration stay aligned.
