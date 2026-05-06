-- SkillVerify minimal schema
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Worker profiles (separate from Supabase Auth user)
create table if not exists public.workers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  primary_skill text not null,
  years_experience int not null,
  portfolio_link text,
  score int not null default 0,
  verified boolean not null default false,
  failed_until timestamptz,
  suspicious_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one account per phone at DB level too
create unique index if not exists workers_phone_unique on public.workers (phone);

-- Optional: one account per email at profile level
create unique index if not exists workers_email_unique on public.workers (email);

-- Row Level Security (RLS)
alter table public.workers enable row level security;

-- Workers can read/update their own row
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'Workers can read own profile'
  ) then
    create policy "Workers can read own profile"
      on public.workers for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'Workers can insert own profile'
  ) then
    create policy "Workers can insert own profile"
      on public.workers for insert
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'Workers can update own profile'
  ) then
    create policy "Workers can update own profile"
      on public.workers for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Public browsing of verified workers (companies)
-- Exposes only what the frontend selects; still recommended not to select phone.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'Public can read verified workers'
  ) then
    create policy "Public can read verified workers"
      on public.workers for select
      using (verified = true and score >= 70 and (failed_until is null or failed_until <= now()));
  end if;
end $$;

-- Interview sessions (server-managed state)
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  skill text not null,
  question_index int not null default 0,
  messages jsonb not null default '[]'::jsonb,
  per_question_scores jsonb not null default '[]'::jsonb,
  total_score int not null default 0,
  status text not null default 'in_progress',
  coding_task text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_worker_id_idx
  on public.interview_sessions(worker_id);

alter table public.interview_sessions enable row level security;

-- Only allow the owner (auth.uid) to read their own sessions
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'interview_sessions' and policyname = 'Workers can read own interview sessions'
  ) then
    create policy "Workers can read own interview sessions"
      on public.interview_sessions for select
      using (auth.uid() = worker_id);
  end if;
end $$;

-- Company contact requests (no direct worker contact info exposed)
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  company_name text not null,
  company_email text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

-- Anyone can create a contact request (you can tighten later with company auth)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_requests' and policyname = 'Anyone can create contact requests'
  ) then
    create policy "Anyone can create contact requests"
      on public.contact_requests for insert
      with check (true);
  end if;
end $$;

