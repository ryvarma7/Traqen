-- Traqen database schema
-- Safe to run on a new or existing Supabase project. Existing tables and
-- policies are preserved; missing columns/policies are added below.
-- Related dashboard setting: Authentication → Providers → Email → turn OFF "Confirm email".

create extension if not exists "uuid-ossp";

-- Profiles: maps a chosen username to the real auth user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email_internal text not null,
  auth_provider text not null default 'google',
  -- Per-user UI preferences.
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Usernames are display names ("Ready for a quick check in Yeshwanth"), not
-- identifiers — two people may share one, and the hub greeting shows them
-- verbatim. Older databases were created with `username text unique`, which
-- made renaming to a name another account already held fail with a unique
-- violation (surfaced to the user as a bare "Failed to update username").
-- Idempotent, so it is safe on a fresh install and as a repair on an existing
-- one. Postgres auto-named the constraint profiles_username_key.
alter table public.profiles drop constraint if exists profiles_username_key;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- NOTE: the legacy username->email lookup (get_email_for_username) that used to
-- live here is deliberately NOT created any more. It resolved a username to a
-- real email address, which is exactly the enumeration risk Google-only auth
-- removes by having no password flow to support. schema-v2.sql drops it on
-- existing databases; a fresh install must never recreate it.

-- First Google sign-in: create the profiles row if it doesn't exist yet.
-- Username is derived from the Google account's email local part. The real
-- Google email never leaves auth.users — the UI only ever sees the username.
-- Usernames are display names, not identifiers, so they aren't unique.
--
-- search_path is pinned to '' because this is SECURITY DEFINER: an empty path
-- means no object in any schema can be substituted for an unqualified name
-- here, closing the classic search_path hijack. Every reference is qualified.
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

-- Extensible per-user dropdown options ("+ Add new")
create table if not exists public.dropdown_options (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  section text not null check (section in ('jobs','hackathons')),
  field_name text not null,
  value text not null,
  created_at timestamptz default now(),
  unique (user_id, section, field_name, value)
);

alter table public.dropdown_options enable row level security;
drop policy if exists "Users manage own dropdown options" on public.dropdown_options;
create policy "Users manage own dropdown options"
  on public.dropdown_options for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Job applications
create table if not exists public.job_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company text not null,
  role_type text,
  status text default 'Saved',
  stage_detail text,
  priority text default 'Medium',
  location_mode text,
  start_date date,
  end_date date,
  deadline date,
  applied_date date,
  follow_up_date date,
  application_link text,
  source text,
  contact_person text,
  salary_range text,
  next_action text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.job_applications enable row level security;
drop policy if exists "Users manage own job applications" on public.job_applications;
create policy "Users manage own job applications"
  on public.job_applications for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Hackathons / buildathons / competitions
create table if not exists public.hackathons (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  hackathon_name text not null,
  organizing_company text,
  type text,
  purpose text,
  theme_track text,
  track_details text,
  mode text,
  team_size int,
  team_members text,
  status text default 'Saved',
  round_detail text,
  priority text default 'Medium',
  start_date date,
  end_date date,
  deadline date,
  applied_date date,
  follow_up_date date,
  application_link text,
  source text,
  team_status text,
  submission_link text,
  result_rank text,
  project_link text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.hackathons enable row level security;
drop policy if exists "Users manage own hackathons" on public.hackathons;
create policy "Users manage own hackathons"
  on public.hackathons for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Tasks (optionally linked to a job application or a hackathon)
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  notes text,
  status text default 'To do' check (status in ('To do','In progress','Done')),
  priority text default 'Medium',
  due_date date,
  category text,
  related_type text check (related_type in ('job','hackathon')),
  related_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks"
  on public.tasks for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Notes
create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text,
  pinned boolean default false,
  color text default 'gray',
  private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notes enable row level security;
drop policy if exists "Users manage own notes" on public.notes;
create policy "Users manage own notes"
  on public.notes for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Migration for existing databases: add notes to tasks.
-- If your tasks table already exists, run just this statement once in
-- Supabase → SQL Editor (the full create table above already includes it).
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- Migration for existing databases: add the privacy flag to notes.
-- If your notes table already exists, run just this statement once in
-- Supabase → SQL Editor (the full create table above already includes it).
-- ---------------------------------------------------------------------------
alter table public.notes add column if not exists private boolean default false;

-- ---------------------------------------------------------------------------
-- Learning tracks (Course Tracker).
-- AI plans a course externally; the user pastes the JSON plan and Traqen
-- normalizes it into tracks → phases → items rows for visual tracking.
-- ---------------------------------------------------------------------------
create table if not exists public.learning_tracks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  start_date date not null,
  status text default 'In progress' check (status in ('In progress','Completed','On hold')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.learning_tracks enable row level security;
drop policy if exists "Users manage own learning tracks" on public.learning_tracks;
create policy "Users manage own learning tracks"
  on public.learning_tracks for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.track_phases (
  id uuid primary key default uuid_generate_v4(),
  track_id uuid references public.learning_tracks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  position int not null default 0,
  title text not null,
  description text
);

alter table public.track_phases enable row level security;
drop policy if exists "Users manage own track phases" on public.track_phases;
create policy "Users manage own track phases"
  on public.track_phases for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.track_items (
  id uuid primary key default uuid_generate_v4(),
  track_id uuid references public.learning_tracks(id) on delete cascade not null,
  phase_id uuid references public.track_phases(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  position int not null default 0,
  title text not null,
  description text,
  resource_url text,
  target_date date,
  status text default 'To do' check (status in ('To do','In progress','Done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.track_items enable row level security;
drop policy if exists "Users manage own track items" on public.track_items;
create policy "Users manage own track items"
  on public.track_items for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Indexes. Every RLS policy filters on user_id, so the per-user indexes are on
-- the hot path of literally every query the app makes -- without them Postgres
-- seq-scans the table and then discards rows the policy rejects. The track_id /
-- phase_id indexes back the cascade deletes and the track detail page.
create index if not exists idx_track_items_track_id on public.track_items(track_id);
create index if not exists idx_track_phases_track_id on public.track_phases(track_id);
create index if not exists idx_learning_tracks_user_id on public.learning_tracks(user_id);
create index if not exists idx_job_applications_user_id on public.job_applications(user_id);
create index if not exists idx_hackathons_user_id on public.hackathons(user_id);
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_track_phases_user_id on public.track_phases(user_id);
create index if not exists idx_track_items_user_id on public.track_items(user_id);
create index if not exists idx_track_items_phase_id on public.track_items(phase_id);

-- ---------------------------------------------------------------------------
-- Table privileges. RLS decides WHICH rows are visible, but Postgres also
-- requires table-level GRANTs — without them every query fails with 403
-- "permission denied" even when the policies pass, and the signup profile
-- insert fails so new users can never log in.
-- Nothing is granted to anon. Google OAuth does not need an unauthenticated
-- email lookup RPC.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.dropdown_options to authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;
grant select, insert, update, delete on public.hackathons to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.learning_tracks to authenticated;
grant select, insert, update, delete on public.track_phases to authenticated;
grant select, insert, update, delete on public.track_items to authenticated;

-- ---------------------------------------------------------------------------
-- Migration for existing databases: schema v2 (Google OAuth era).
-- Run each statement once in Supabase → SQL Editor. Fresh installs already
-- have all of these from the create table statements above.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists auth_provider text not null default 'google';
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.job_applications add column if not exists salary_range text;
alter table public.job_applications add column if not exists next_action text;
alter table public.hackathons add column if not exists team_status text;
alter table public.hackathons add column if not exists submission_link text;
