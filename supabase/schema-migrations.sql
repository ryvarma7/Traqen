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
alter table public.learning_tracks add column if not exists end_date date;
alter table public.job_applications add column if not exists application_link text;
alter table public.hackathons add column if not exists application_link text;
alter table public.hackathons add column if not exists project_link text;
alter table public.track_items add column if not exists resource_url text;

-- Enforce the current value vocabulary for new writes without requiring a
-- destructive cleanup of historical rows. NOT VALID constraints still check
-- every insert/update; a later data-cleanup pass may validate them in place.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_applications_status_check') then
    alter table public.job_applications add constraint job_applications_status_check
      check (status is null or status in ('Saved','Applied','Interview','Shortlisted','Offer','Rejected','Withdrawn')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_applications_priority_check') then
    alter table public.job_applications add constraint job_applications_priority_check
      check (priority is null or priority in ('High','Medium','Low')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hackathons_status_check') then
    alter table public.hackathons add constraint hackathons_status_check
      check (status is null or status in ('Saved','Applied','Shortlisted','In progress','Winner','Not selected','Withdrawn')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hackathons_priority_check') then
    alter table public.hackathons add constraint hackathons_priority_check
      check (priority is null or priority in ('High','Medium','Low')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks add constraint tasks_priority_check
      check (priority is null or priority in ('High','Medium','Low')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notes_color_check') then
    alter table public.notes add constraint notes_color_check
      check (color is null or color in ('gray','red','orange','amber','green','blue','violet')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'learning_tracks_date_range') then
    alter table public.learning_tracks add constraint learning_tracks_date_range
      check (end_date is null or end_date >= start_date) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'track_phases_position_check') then
    alter table public.track_phases add constraint track_phases_position_check
      check (position >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'track_items_position_check') then
    alter table public.track_items add constraint track_items_position_check
      check (position >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dropdown_field_name_check') then
    alter table public.dropdown_options add constraint dropdown_field_name_check check (
      (section = 'jobs' and field_name in ('role_type','location_mode','source'))
      or
      (section = 'hackathons' and field_name in ('type','purpose','theme_track','mode','source'))
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_applications_application_link_check') then
    alter table public.job_applications add constraint job_applications_application_link_check
      check (application_link is null or application_link ~* '^https?://[^[:space:]]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hackathons_application_link_check') then
    alter table public.hackathons add constraint hackathons_application_link_check
      check (application_link is null or application_link ~* '^https?://[^[:space:]]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hackathons_project_link_check') then
    alter table public.hackathons add constraint hackathons_project_link_check
      check (project_link is null or project_link ~* '^https?://[^[:space:]]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'track_items_resource_url_check') then
    alter table public.track_items add constraint track_items_resource_url_check
      check (resource_url is null or resource_url ~* '^https?://[^[:space:]]+$') not valid;
  end if;
end
$$;

-- Transactional track mutations. These functions are SECURITY INVOKER so the
-- authenticated caller's RLS policies remain active inside every transaction.
create or replace function public.create_learning_track(
  p_title text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_phases jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_track_id uuid;
  v_phase_id uuid;
  v_phase jsonb;
  v_item jsonb;
  v_items jsonb;
  v_title text;
  v_description text;
  v_resource_url text;
  v_target_date date;
  v_phase_index integer;
  v_item_index integer;
  v_total_items integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_title is null or char_length(btrim(p_title)) < 1 or char_length(p_title) > 500 then
    raise exception 'Invalid track title' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 5000 then
    raise exception 'Invalid track description' using errcode = '22023';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Invalid track date range' using errcode = '22023';
  end if;
  if p_phases is null or jsonb_typeof(p_phases) is distinct from 'array'
     or jsonb_array_length(p_phases) < 1 or jsonb_array_length(p_phases) > 12 then
    raise exception 'Invalid track phase count' using errcode = '22023';
  end if;

  insert into public.learning_tracks (user_id, title, description, start_date, end_date, status)
  values (v_user_id, btrim(p_title), nullif(p_description, ''), p_start_date, p_end_date, 'In progress')
  returning id into v_track_id;

  for v_phase_index in 0..jsonb_array_length(p_phases) - 1 loop
    v_phase := p_phases -> v_phase_index;
    v_title := v_phase ->> 'title';
    v_description := nullif(v_phase ->> 'description', '');
    v_items := v_phase -> 'items';
    if jsonb_typeof(v_phase) is distinct from 'object'
       or v_title is null or char_length(btrim(v_title)) < 1 or char_length(v_title) > 500
       or (v_description is not null and char_length(v_description) > 5000)
       or v_items is null or jsonb_typeof(v_items) is distinct from 'array'
       or jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 16 then
      raise exception 'Invalid track phase' using errcode = '22023';
    end if;
    v_total_items := v_total_items + jsonb_array_length(v_items);
    if v_total_items > 96 then raise exception 'Track contains too many steps' using errcode = '22023'; end if;

    insert into public.track_phases (track_id, user_id, position, title, description)
    values (v_track_id, v_user_id, v_phase_index, btrim(v_title), v_description)
    returning id into v_phase_id;

    for v_item_index in 0..jsonb_array_length(v_items) - 1 loop
      v_item := v_items -> v_item_index;
      v_title := v_item ->> 'title';
      v_description := nullif(v_item ->> 'description', '');
      v_resource_url := nullif(btrim(v_item ->> 'resource_url'), '');
      v_target_date := null;
      if jsonb_typeof(v_item) is distinct from 'object'
         or v_title is null or char_length(btrim(v_title)) < 1 or char_length(v_title) > 500
         or (v_description is not null and char_length(v_description) > 5000)
         or (v_resource_url is not null and (char_length(v_resource_url) > 2000 or v_resource_url !~* '^https?://[^[:space:]]+$')) then
        raise exception 'Invalid track step' using errcode = '22023';
      end if;
      if nullif(v_item ->> 'target_date', '') is not null then
        v_target_date := (v_item ->> 'target_date')::date;
        if v_target_date < p_start_date or (p_end_date is not null and v_target_date > p_end_date) then
          raise exception 'Track step is outside the plan window' using errcode = '22023';
        end if;
      end if;
      insert into public.track_items (
        track_id, phase_id, user_id, position, title, description, resource_url, target_date, status
      ) values (
        v_track_id, v_phase_id, v_user_id, v_item_index, btrim(v_title), v_description,
        v_resource_url, v_target_date, 'To do'
      );
    end loop;
  end loop;
  return v_track_id;
end;
$$;

create or replace function public.reschedule_learning_track(p_track_id uuid, p_new_start date)
returns table (moved integer, delta integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_first_date date;
  v_delta integer;
  v_moved integer;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.learning_tracks where id = p_track_id and user_id = v_user_id) then
    raise exception 'Track not found' using errcode = 'P0002';
  end if;
  select min(target_date) into v_first_date from public.track_items
   where track_id = p_track_id and user_id = v_user_id and status <> 'Done' and target_date is not null;
  if v_first_date is null then return query select 0, 0; return; end if;
  v_delta := p_new_start - v_first_date;
  if v_delta = 0 then
    select count(*)::integer into v_moved from public.track_items
     where track_id = p_track_id and user_id = v_user_id and status <> 'Done' and target_date is not null;
    return query select v_moved, 0; return;
  end if;
  update public.track_items set target_date = target_date + v_delta, updated_at = now()
   where track_id = p_track_id and user_id = v_user_id and status <> 'Done' and target_date is not null;
  get diagnostics v_moved = row_count;
  return query select v_moved, v_delta;
end;
$$;

create or replace function public.set_track_item_status(p_item_id uuid, p_status text)
returns table (track_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_track_id uuid;
  v_item_count integer;
  v_done boolean;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_status not in ('To do', 'In progress', 'Done') then
    raise exception 'Invalid track step status' using errcode = '22023';
  end if;
  select i.track_id into v_track_id from public.track_items i where i.id = p_item_id and i.user_id = v_user_id;
  if not found then raise exception 'Track step not found' using errcode = 'P0002'; end if;
  update public.track_items set status = p_status, updated_at = now() where id = p_item_id and user_id = v_user_id;
  select count(*)::integer, coalesce(bool_and(status = 'Done'), false) into v_item_count, v_done
    from public.track_items where track_id = v_track_id and user_id = v_user_id;
  update public.learning_tracks
     set status = case when v_item_count > 0 and v_done then 'Completed' else 'In progress' end,
         updated_at = now()
   where id = v_track_id and user_id = v_user_id and status <> 'On hold';
  return query select v_track_id;
end;
$$;

create or replace function public.reorder_track_items(p_item_id uuid, p_direction text)
returns table (moved boolean, track_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_track_id uuid;
  v_phase_id uuid;
  v_order uuid[];
  v_index integer;
  v_position integer;
  v_tmp uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_direction not in ('up', 'down') then raise exception 'Invalid move direction' using errcode = '22023'; end if;
  select i.track_id, i.phase_id into v_track_id, v_phase_id
    from public.track_items i where i.id = p_item_id and i.user_id = v_user_id;
  if not found then raise exception 'Track step not found' using errcode = 'P0002'; end if;
  select array_agg(i.id order by i.position, i.id) into v_order
    from public.track_items i where i.phase_id = v_phase_id and i.user_id = v_user_id;
  v_index := array_position(v_order, p_item_id);
  if p_direction = 'up' and v_index = 1 then return query select false, v_track_id; return; end if;
  if p_direction = 'down' and v_index = array_length(v_order, 1) then return query select false, v_track_id; return; end if;
  v_position := case when p_direction = 'up' then v_index - 1 else v_index + 1 end;
  v_tmp := v_order[v_position];
  v_order[v_position] := v_order[v_index];
  v_order[v_index] := v_tmp;
  for v_position in 1..array_length(v_order, 1) loop
    update public.track_items set position = v_position - 1, updated_at = now()
     where id = v_order[v_position] and phase_id = v_phase_id and user_id = v_user_id;
  end loop;
  return query select true, v_track_id;
end;
$$;

create or replace function public.move_track_item_to_phase(p_item_id uuid, p_phase_id uuid)
returns table (moved boolean, track_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_track_id uuid;
  v_old_phase_id uuid;
  v_position integer;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select i.track_id, i.phase_id into v_track_id, v_old_phase_id
    from public.track_items i where i.id = p_item_id and i.user_id = v_user_id;
  if not found then raise exception 'Track step not found' using errcode = 'P0002'; end if;
  if v_old_phase_id = p_phase_id then return query select false, v_track_id; return; end if;
  if not exists (
    select 1 from public.track_phases p where p.id = p_phase_id and p.track_id = v_track_id and p.user_id = v_user_id
  ) then raise exception 'Target phase not found' using errcode = 'P0002'; end if;
  select coalesce(max(i.position), -1) + 1 into v_position
    from public.track_items i where i.phase_id = p_phase_id and i.user_id = v_user_id;
  update public.track_items set phase_id = p_phase_id, position = v_position, updated_at = now()
   where id = p_item_id and user_id = v_user_id;
  with ordered as (
    select i.id, (row_number() over (order by i.position, i.id) - 1)::integer as new_position
      from public.track_items i where i.phase_id = v_old_phase_id and i.user_id = v_user_id
  )
  update public.track_items i set position = ordered.new_position, updated_at = now()
    from ordered where i.id = ordered.id and i.user_id = v_user_id;
  with ordered as (
    select i.id, (row_number() over (order by i.position, i.id) - 1)::integer as new_position
      from public.track_items i where i.phase_id = p_phase_id and i.user_id = v_user_id
  )
  update public.track_items i set position = ordered.new_position, updated_at = now()
    from ordered where i.id = ordered.id and i.user_id = v_user_id;
  return query select true, v_track_id;
end;
$$;

grant execute on function public.create_learning_track(text, text, date, date, jsonb) to authenticated;
grant execute on function public.reschedule_learning_track(uuid, date) to authenticated;
grant execute on function public.set_track_item_status(uuid, text) to authenticated;
grant execute on function public.reorder_track_items(uuid, text) to authenticated;
grant execute on function public.move_track_item_to_phase(uuid, uuid) to authenticated;
revoke all on function public.create_learning_track(text, text, date, date, jsonb) from public, anon;
revoke all on function public.reschedule_learning_track(uuid, date) from public, anon;
revoke all on function public.set_track_item_status(uuid, text) from public, anon;
revoke all on function public.reorder_track_items(uuid, text) from public, anon;
revoke all on function public.move_track_item_to_phase(uuid, uuid) from public, anon;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'learning_tracks_id_user_key'
  ) then
    alter table public.learning_tracks add constraint learning_tracks_id_user_key unique (id, user_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'track_phases_id_track_user_key'
  ) then
    alter table public.track_phases add constraint track_phases_id_track_user_key unique (id, track_id, user_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'track_phases_track_owner_fkey'
  ) then
    alter table public.track_phases add constraint track_phases_track_owner_fkey
      foreign key (track_id, user_id)
      references public.learning_tracks(id, user_id)
      on delete cascade
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'track_items_phase_owner_fkey'
  ) then
    alter table public.track_items add constraint track_items_phase_owner_fkey
      foreign key (phase_id, track_id, user_id)
      references public.track_phases(id, track_id, user_id)
      on delete cascade
      not valid;
  end if;
end
$$;

-- Server-side learning-plan generation quota. Direct client writes are never
-- granted; authenticated actions use the two RPCs below.
create table if not exists public.learning_plan_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  usage_date date not null,
  used integer not null default 0 check (used >= 0 and used <= 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, usage_date)
);

create unique index if not exists idx_learning_plan_usage_user_date
  on public.learning_plan_usage(user_id, usage_date);

create or replace function public.consume_learning_plan_quota()
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  quota_limit integer,
  reset_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'UTC')::date;
  v_limit constant integer := 5;
  v_used integer;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  insert into public.learning_plan_usage (user_id, usage_date, used)
  values (v_user_id, v_today, 1)
  on conflict (user_id, usage_date) do nothing;

  if found then
    v_used := 1;
    v_allowed := true;
  else
    select u.used
      into v_used
      from public.learning_plan_usage u
     where u.user_id = v_user_id
       and u.usage_date = v_today
     for update;

    if v_used < v_limit then
      update public.learning_plan_usage
         set used = v_used + 1,
             updated_at = now()
       where user_id = v_user_id
         and usage_date = v_today;
      v_used := v_used + 1;
      v_allowed := true;
    end if;
  end if;

  return query
  select v_allowed,
         v_used,
         greatest(0, v_limit - v_used),
         v_limit,
         v_today + 1;
end;
$$;

create or replace function public.get_learning_plan_quota()
returns table (
  used integer,
  remaining integer,
  quota_limit integer,
  reset_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.used, 0),
         greatest(0, 5 - coalesce(u.used, 0)),
         5,
         ((now() at time zone 'UTC')::date + 1)
    from (select auth.uid() as user_id) caller
    left join public.learning_plan_usage u
      on u.user_id = caller.user_id
     and u.usage_date = (now() at time zone 'UTC')::date
   where caller.user_id is not null;
$$;

grant execute on function public.consume_learning_plan_quota() to authenticated;
revoke all on function public.consume_learning_plan_quota() from public, anon;
grant execute on function public.get_learning_plan_quota() to authenticated;
revoke all on function public.get_learning_plan_quota() from public, anon;

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
        'tasks', 'notes', 'learning_tracks', 'track_phases', 'track_items',
        'learning_plan_usage'
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
alter table public.learning_plan_usage enable row level security;

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
create policy "Users can view own learning plan usage"
  on public.learning_plan_usage for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Do not expose the internal email/provider columns through the ordinary
-- authenticated Data API. The SECURITY DEFINER provisioning function retains
-- the ability to write them, while application reads can only see display data.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, preferences) on public.profiles to authenticated;
grant update (username, preferences) on public.profiles to authenticated;

revoke all on public.dropdown_options, public.job_applications, public.hackathons,
  public.tasks, public.notes, public.learning_tracks, public.track_phases,
  public.track_items, public.learning_plan_usage from anon;
grant select, insert, update, delete on public.dropdown_options to authenticated;
grant select, insert, update, delete on public.job_applications to authenticated;
grant select, insert, update, delete on public.hackathons to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.learning_tracks to authenticated;
grant select, insert, update, delete on public.track_phases to authenticated;
grant select, insert, update, delete on public.track_items to authenticated;
revoke all on public.learning_plan_usage from anon, authenticated;

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
create index if not exists idx_learning_plan_usage_user_id
  on public.learning_plan_usage(user_id, usage_date desc);

commit;
