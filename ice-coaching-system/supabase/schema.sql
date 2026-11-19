-- ICE COACHING SYSTEM · Supabase schema
-- Run in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('coach','trainee');
create type public.assignment_period as enum ('monthly','weekly','daily');
create type public.assignment_status as enum ('draft','published','completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'trainee',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.coach_trainees (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(coach_id, trainee_id),
  check (coach_id <> trainee_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  period public.assignment_period not null,
  starts_on date not null,
  ends_on date not null,
  focus text,
  notes text,
  status public.assignment_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.assignment_exercises (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  exercise_name text not null,
  sort_order int not null default 0,
  sets int not null default 3 check (sets > 0),
  reps text not null default '8-12',
  target_weight numeric(7,2),
  rest_seconds int,
  rir numeric(3,1),
  coach_cue text
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_exercise_id uuid not null references public.assignment_exercises(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  performed_on date not null default current_date,
  set_number int not null default 1,
  actual_reps int,
  actual_weight numeric(7,2),
  rir numeric(3,1),
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  body_weight numeric(6,2),
  sleep_hours numeric(3,1),
  energy int check (energy between 1 and 10),
  soreness int check (soreness between 1 and 10),
  notes text
);

create index assignments_coach_period_idx on public.assignments(coach_id, period, starts_on);
create index assignments_trainee_idx on public.assignments(trainee_id, starts_on);
create index logs_trainee_date_idx on public.workout_logs(trainee_id, performed_on desc);

create or replace function public.is_coach_of(target_trainee uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.coach_trainees where coach_id = auth.uid() and trainee_id = target_trainee and active); $$;

alter table public.profiles enable row level security;
alter table public.coach_trainees enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.check_ins enable row level security;

create policy "profile self read" on public.profiles for select using (id = auth.uid() or public.is_coach_of(id));
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "coach trainee links read" on public.coach_trainees for select using (coach_id = auth.uid() or trainee_id = auth.uid());
create policy "coach create trainee links" on public.coach_trainees for insert with check (coach_id = auth.uid() and exists(select 1 from public.profiles p where p.id = trainee_id and p.role = 'trainee') and exists(select 1 from public.profiles p where p.id = coach_id and p.role = 'coach'));
create policy "coach remove trainee links" on public.coach_trainees for delete using (coach_id = auth.uid());

create policy "assignment read" on public.assignments for select using (coach_id = auth.uid() or trainee_id = auth.uid());
create policy "coach create assignments" on public.assignments for insert with check (coach_id = auth.uid() and (trainee_id is null or public.is_coach_of(trainee_id)));
create policy "coach update assignments" on public.assignments for update using (coach_id = auth.uid()) with check (coach_id = auth.uid() and (trainee_id is null or public.is_coach_of(trainee_id)));
create policy "coach delete assignments" on public.assignments for delete using (coach_id = auth.uid());

create policy "exercise read through assignment" on public.assignment_exercises for select using (
 exists(select 1 from public.assignments a where a.id = assignment_id and (a.coach_id = auth.uid() or a.trainee_id = auth.uid()))
);
create policy "coach manage exercises" on public.assignment_exercises for all using (
 exists(select 1 from public.assignments a where a.id = assignment_id and a.coach_id = auth.uid())
) with check (
 exists(select 1 from public.assignments a where a.id = assignment_id and a.coach_id = auth.uid())
);

create policy "workout logs visible to trainee and coach" on public.workout_logs for select using (trainee_id = auth.uid() or public.is_coach_of(trainee_id));
create policy "trainee create own logs" on public.workout_logs for insert with check (trainee_id = auth.uid());
create policy "trainee update own logs" on public.workout_logs for update using (trainee_id = auth.uid()) with check (trainee_id = auth.uid());

create policy "checkins visible to trainee and coach" on public.check_ins for select using (trainee_id = auth.uid() or public.is_coach_of(trainee_id));
create policy "trainee submit own checkins" on public.check_ins for insert with check (trainee_id = auth.uid());
create policy "trainee update own checkins" on public.check_ins for update using (trainee_id = auth.uid()) with check (trainee_id = auth.uid());

-- Create the first Coach Ice account through Supabase Auth, then promote its profile:
-- update public.profiles set role = 'coach', full_name = 'Coach Ice' where id = '<AUTH_USER_UUID>';
