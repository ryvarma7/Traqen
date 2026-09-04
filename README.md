# Traqen

A personal productivity dashboard for tracking job applications, hackathons, tasks, and notes.

## Tech stack

- **Next.js 14** (App Router) + TypeScript strict mode
- **Tailwind CSS** with a custom theme (off-white background, single indigo accent, restrained shadows)
- **Framer Motion** for page transitions, staggered lists, and sheet/modal animations
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) for auth and Postgres with RLS
- **react-hook-form + zod** for forms and validation
- **Geist Sans / Geist Mono** via next/font, **lucide-react** icons

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run the schema in `supabase/schema.sql` once in the SQL Editor.

3. In the Supabase dashboard: **Authentication → Providers → Email → turn OFF "Confirm email"**.
   Signups use generated `username@traqen.local` addresses, so Supabase can never deliver a
   confirmation email — leaving this on locks every new user out.

4. Copy the two values from **Supabase → Project Settings → API** into `.env.local`.
   Newer projects show a **Publishable key** (`sb_publishable_…`); older ones show an
   `anon` JWT — either works, the app reads both names:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

## Auth model

Username + password only (no OAuth, no email verification). Each account maps a chosen username to
a generated Supabase auth email (`username@traqen.local`). Login resolves the username to the real
email via the `get_email_for_username` Postgres function (SECURITY DEFINER), so the `profiles`
table is never exposed to anonymous reads.

## Structure

| Route | Purpose |
| --- | --- |
| `/` | Hub — needs-attention strip + Applications / Tasks / Notes cards |
| `/applications` | Jobs and hackathons — sortable table on desktop, card stack on mobile |
| `/tasks` | Tasks grouped by status — Kanban columns / collapsible accordions |
| `/notes` | Note tiles with inline view/edit |
| `/login`, `/signup` | Auth pages |

## Deployment

Deploy to Vercel and set the same two environment variables under **Project → Settings →
Environment Variables**.
</content>
</tool>
</tool_calls>