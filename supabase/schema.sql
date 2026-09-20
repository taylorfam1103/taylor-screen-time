-- Taylor Screen Time Tracker
-- Run this entire file in Supabase > SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text not null check (color in ('blue','green','orange','gold','pink')),
  avatar_path text not null,
  weekly_allowance_minutes integer not null default 0 check (weekly_allowance_minutes >= 0),
  daily_limit_minutes integer not null default 180 check (daily_limit_minutes > 0),
  rollover_cap_minutes integer not null default 120 check (rollover_cap_minutes >= 0),
  weekly_start_cap_minutes integer not null default 720 check (weekly_start_cap_minutes > 0),
  tracking_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint timer_end_after_start check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists one_active_timer_per_profile
  on public.timer_sessions(profile_id)
  where ended_at is null;

create index if not exists timer_sessions_profile_started_idx
  on public.timer_sessions(profile_id, started_at desc);

create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bonus','deduction')),
  minutes integer not null check (minutes > 0),
  note text not null default '',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists adjustments_profile_date_idx
  on public.adjustments(profile_id, occurred_on desc);

create table if not exists public.weekly_ledgers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  base_minutes numeric not null,
  carryover_minutes numeric not null default 0,
  opening_minutes numeric not null,
  created_at timestamptz not null default now(),
  primary key(profile_id, week_start)
);

alter table public.profiles enable row level security;
alter table public.timer_sessions enable row level security;
alter table public.adjustments enable row level security;
alter table public.weekly_ledgers enable row level security;

-- No public RLS policies are intentionally created.
-- The app talks to Supabase only through server-side Next.js API routes using the server-side Supabase secret key.

insert into public.profiles
  (slug,name,color,avatar_path,weekly_allowance_minutes,daily_limit_minutes,rollover_cap_minutes,weekly_start_cap_minutes,tracking_enabled,sort_order)
values
  ('zayn','Zayn','orange','/avatars/zayn.png',600,180,120,720,true,1),
  ('judah','Judah','gold','/avatars/judah.png',600,180,120,720,true,2),
  ('maizy','Maizy','pink','/avatars/maizy.png',0,180,120,720,false,3),
  ('seth','Seth','blue','/avatars/seth.png',0,180,120,720,false,4),
  ('taylor','Taylor','green','/avatars/taylor.png',0,180,120,720,false,5)
on conflict (slug) do update set
  name=excluded.name,
  color=excluded.color,
  avatar_path=excluded.avatar_path,
  sort_order=excluded.sort_order;
