-- Traqen database schema
-- Run this entire block once in Supabase → SQL Editor.
-- Related dashboard setting: Authentication → Providers → Email → turn OFF "Confirm email".

create extension if not exists "uuid-ossp";

-- Profiles: maps a chosen username to the real auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email_internal text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Secure lookup used by the login form (username -> real email),
-- without exposing the profiles table to anonymous reads.
create or replace function public.get_email_for_username(uname text)
returns text
language sql
security definer
set search_path = public
as $$
  select email_internal from public.profiles where username = lower(uname) limit 1;
$$;

grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- Extensible per-user dropdown options ("+ Add new")
create table public.dropdown_options (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  section text not null check (section in ('jobs','hackathons')),
  field_name text not null,
  value text not null,
  created_at timestamptz default now(),
  unique (user_id, section, field_name, value)
);

alter table public.dropdown_options enable row level security;
create policy "Users manage own dropdown options"
  on public.dropdown_options for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Job applications
create table public.job_applications (
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
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.job_applications enable row level security;
create policy "Users manage own job applications"
  on public.job_applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hackathons / buildathons / competitions
create table public.hackathons (
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
  result_rank text,
  project_link text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.hackathons enable row level security;
create policy "Users manage own hackathons"
  on public.hackathons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tasks (optionally linked to a job application or a hackathon)
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
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
create policy "Users manage own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notes
create table public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text,
  pinned boolean default false,
  color text default 'gray',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notes enable row level security;
create policy "Users manage own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);