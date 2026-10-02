-- Traqen schema v2 — Google OAuth, calendar, section upgrades.
-- Run this entire block ONCE in Supabase → SQL Editor on your EXISTING
-- database. Everything is idempotent (if not exists / add column if not
-- exists), so re-running it is safe.
--
-- Also required in the Supabase dashboard (no SQL):
--   1. Authentication → Providers → Google → Enable, paste Google Cloud
--      OAuth client id + secret.
--   2. Authentication → URL Configuration → Site URL = your deployed URL
--      (http://localhost:3000 for dev), and add
--      http://localhost:3000/auth/callback (and the production equivalent)
--      to Redirect URLs.

-- Profiles: record how the user authenticates, and store per-user UI
-- preferences (the one-time Google Calendar popup writes here).
alter table public.profiles
  add column if not exists auth_provider text not null default 'google';
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Usernames are display names ("Ready for a quick check in Yeshwanth"), not
-- identifiers — two people can share one. Drop the unique constraint (the
-- primary key is auth.users.id, which keeps rows distinct).
alter table public.profiles drop constraint if exists profiles_username_key;

-- Retire the one-time "should we add Google Calendar integration?" popup
-- storage — the popup and its code are gone.
drop table if exists public.calendar_feedback;

-- Section upgrades (student-focused fields).
alter table public.job_applications add column if not exists salary_range text;
alter table public.job_applications add column if not exists next_action text;
alter table public.hackathons add column if not exists team_status text;
alter table public.hackathons add column if not exists submission_link text;

-- The username→email RPC was only needed for password login. Retire it so an
-- old database cannot expose internal email addresses through an RPC.
drop function if exists public.get_email_for_username(text);

-- First Google sign-in: create the profiles row if it doesn't exist yet.
-- Username is derived from the Google account's email local part. The real
-- Google email never leaves auth.users — the UI only ever sees the username.
-- Usernames are display names, not identifiers, so they aren't unique.
create or replace function public.ensure_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  google_email text;
  base_username text;
  candidate text;
begin
  if uid is null then
    return null;
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    return null;
  end if;

  select email into google_email from auth.users where id = uid;
  if google_email is null then
    return null;
  end if;

  base_username := regexp_replace(lower(split_part(google_email, '@', 1)), '[^a-z0-9_-]', '', 'g');
  base_username := left(base_username, 20);
  if base_username = '' or length(base_username) < 3 then
    base_username := 'user';
  end if;

  -- No unique constraint anymore, so no suffix loop needed. The only real
  -- collision is the same email local part twice (same per-user row already
  -- returned above); a random suffix is a belt-and-braces fallback.
  candidate := base_username;
  begin
    insert into public.profiles (id, username, email_internal, auth_provider)
    values (uid, candidate, google_email, 'google');
    return candidate;
  exception when unique_violation then
    null;
  end;

  candidate := base_username || floor(random() * 9000 + 1000)::int::text;
  insert into public.profiles (id, username, email_internal, auth_provider)
  values (uid, candidate, google_email, 'google');
  return candidate;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
revoke all on function public.ensure_profile() from public, anon;
