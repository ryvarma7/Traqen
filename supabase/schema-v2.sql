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
--
-- search_path is pinned to '' because this is SECURITY DEFINER: an empty path
-- means no object in any schema can be substituted for an unqualified name
-- here, closing the classic search_path hijack. Every reference is qualified.
-- Keep this body identical to the one in schema.sql — re-running this file
-- replaces the deployed function, so the two must not drift apart again.
create or replace function public.ensure_profile()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_base text;
  v_candidate text;
begin
  if v_uid is null then
    return null;
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    return null;
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    return null;
  end if;

  v_base := regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9_-]', '', 'g');
  v_base := left(v_base, 20);
  if v_base = '' or length(v_base) < 3 then
    v_base := 'user';
  end if;

  -- No unique constraint on username, so there is nothing to collide with. The
  -- exception branch is belt-and-braces only: the primary key on id is always
  -- fresh for a brand-new account.
  v_candidate := v_base;
  begin
    insert into public.profiles (id, username, email_internal, auth_provider)
    values (v_uid, v_candidate, v_email, 'google');
    return v_candidate;
  exception when unique_violation then
    null;
  end;

  v_candidate := v_base || floor(random() * 9000 + 1000)::int::text;
  insert into public.profiles (id, username, email_internal, auth_provider)
  values (v_uid, v_candidate, v_email, 'google');
  return v_candidate;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
revoke all on function public.ensure_profile() from public, anon;
