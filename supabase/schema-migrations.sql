-- Traqen incremental migration for existing Supabase deployments.
-- Run this file once after the canonical fresh-install schema has been applied
-- or against an older Traqen database. It replaces the historical split
-- migration files with one ordered, repeat-safe migration.
--
-- The migration is transactional so a failed step does not leave a half-upgraded
-- database. It also normalizes all client-facing RLS policies rather than
-- leaving an older permissive policy active under a different name.

begin;

create extension if not exists "uuid-ossp";

-- Google OAuth/profile changes.
alter table public.profiles
  add column if not exists auth_provider text not null default 'google';
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_username_key;

-- Fields already present in the canonical schema but missing from older tables.
alter table public.tasks add column if not exists notes text;
alter table public.notes add column if not exists private boolean default false;
alter table public.job_applications add column if not exists salary_range text;
alter table public.job_applications add column if not exists next_action text;
alter table public.hackathons add column if not exists team_status text;
alter table public.hackathons add column if not exists submission_link text;

-- This popup was retired and has no remaining application consumer.
drop table if exists public.calendar_feedback;

-- Retire every historical username-to-email lookup overload, not just the
-- original text signature. No client role should be able to enumerate emails.
do $$
declare
  legacy_function record;
begin
  for legacy_function in
    select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_email_for_username'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      'public', legacy_function.proname, legacy_function.arguments
    );
  end loop;
end
$$;

-- Convert the old UUID task link to the current free-text name link. The
-- catalog checks make this safe for databases that are already migrated.
do $$
declare
  has_related_id boolean;
  has_related_name boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_id'
  ) into has_related_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'related_name'
  ) into has_related_name;

  if has_related_id then
    if not has_related_name then
      alter table public.tasks add column related_name text;
    end if;

    -- Preserve the old identifier before resolving it to a display name.
    execute $sql$
      update public.tasks
         set related_name = related_id::text
       where related_name is null
    $sql$;

    execute $sql$
      update public.tasks t
         set related_name = j.company
        from public.job_applications j
       where t.related_type = 'job'
         and t.related_name = t.related_id::text
         and j.user_id = t.user_id
         and j.id::text = t.related_id::text
    $sql$;

    execute $sql$
      update public.tasks t
         set related_name = h.hackathon_name
        from public.hackathons h
       where t.related_type = 'hackathon'
         and t.related_name = t.related_id::text
         and h.user_id = t.user_id
         and h.id::text = t.related_id::text
    $sql$;

    -- Orphaned legacy references are retained as text instead of being erased.
    -- Clear only the relation type so the UI cannot treat the identifier as a
    -- valid link. Already-migrated free-text UUID-shaped names are untouched.
    execute $sql$
      update public.tasks t
         set related_name = t.related_id::text, related_type = null
       where t.related_name = t.related_id::text
         and not exists (
           select 1 from public.job_applications j
            where t.related_type = 'job'
              and j.user_id = t.user_id
              and j.id::text = t.related_id::text
         )
         and not exists (
           select 1 from public.hackathons h
            where t.related_type = 'hackathon'
              and h.user_id = t.user_id
              and h.id::text = t.related_id::text
         )
    $sql$;

    alter table public.tasks drop column related_id;
  elsif not has_related_name then
    alter table public.tasks add column related_name text;
  end if;
end
$$;

alter table public.tasks
  alter column related_name type text using related_name::text;

create index if not exists idx_notes_user_updated_at
  on public.notes(user_id, updated_at desc);

-- Reinstall the two profile functions with the hardened search_path and the
-- same validation used by the fresh-install schema.
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

create or replace function public.update_profile_username(p_username text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if p_username is null
     or char_length(p_username) < 2
     or char_length(p_username) > 30
     or btrim(p_username) <> p_username
     or p_username ~ '[[:cntrl:]]' then
    raise exception 'Invalid profile username' using errcode = '22023';
  end if;

  update public.profiles
     set username = p_username,
         preferences = jsonb_set(
           coalesce(preferences, '{}'::jsonb),
           '{name_set}',
           'true'::jsonb,
           true
         )
   where id = auth.uid()
   returning username into v_username;

  return v_username;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.update_profile_username(text) to authenticated;
revoke all on function public.update_profile_username(text) from public, anon;

-- Remove every old policy on the application tables before recreating the
-- owner-only set. PostgreSQL combines permissive policies with OR, so dropping
-- only policies with the current names would leave renamed legacy policies able
-- to broaden access.
do $$
declare
  old_policy record;
begin
  for old_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'dropdown_options', 'job_applications', 'hackathons',
        'tasks', 'notes', 'learning_tracks', 'track_phases', 'track_items'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      old_policy.policyname, old_policy.schemaname, old_policy.tablename
    );
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.dropdown_options enable row level security;
alter table public.job_applications enable row level security;
alter table public.hackathons enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.learning_tracks enable row level security;
alter table public.track_phases enable row level security;
alter table public.track_items enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users manage own dropdown options"
  on public.dropdown_options for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own job applications"
  on public.job_applications for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own hackathons"
  on public.hackathons for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own tasks"
  on public.tasks for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own notes"
  on public.notes for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own learning tracks"
  on public.learning_tracks for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own track phases"
  on public.track_phases for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own track items"
  on public.track_items for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Do not expose the internal email/provider columns through the ordinary
-- authenticated Data API. The SECURITY DEFINER provisioning function retains
-- the ability to write them, while application reads can only see display data.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, preferences) on public.profiles to authenticated;
grant update (username, preferences) on public.profiles to authenticated;

revoke all on public.dropdown_options, public.job_applications, public.hackathons,
  public.tasks, public.notes, public.learning_tracks, public.track_phases,
  public.track_items from anon;
grant select, insert, update, delete on public.dropdown_options to authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;
grant select, insert, update, delete on public.hackathons to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.learning_tracks to authenticated;
grant select, insert, update, delete on public.track_phases to authenticated;
grant select, insert, update, delete on public.track_items to authenticated;

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

commit;
