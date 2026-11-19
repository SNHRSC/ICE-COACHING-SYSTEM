-- ICE COACHING SYSTEM · Supabase schema
-- Run once in Supabase SQL Editor. Uses Supabase Auth user UUIDs.
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
  unique(coach_id, trainee_id), check (coach_id <> trainee_id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  period public.assignment_period not null,
  starts_on date not null, ends_on date not null,
  focus text, notes text,
  status public.assignment_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create table public.assignment_exercises (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  exercise_name text not null, sort_order int not null default 0,
  sets int not null default 3 check (sets > 0),
  reps text not null default '8-12',
  target_weight numeric(7,2), rest_seconds int, rir numeric(3,1), coach_cue text
);
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_exercise_id uuid not null references public.assignment_exercises(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  performed_on date not null default current_date,
  set_number int not null default 1,
  actual_reps int, actual_weight numeric(7,2), rir numeric(3,1),
  completed boolean not null default false, notes text,
  created_at timestamptz not null default now()
);
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  body_weight numeric(6,2), sleep_hours numeric(3,1),
  energy int check (energy between 1 and 10),
  soreness int check (soreness between 1 and 10), notes text
);

create index assignments_coach_period_idx on public.assignments(coach_id, period, starts_on);
create index assignments_trainee_idx on public.assignments(trainee_id, starts_on);
create index logs_trainee_date_idx on public.workout_logs(trainee_id, performed_on desc);

-- SECURITY DEFINER helpers avoid recursive RLS checks for role and coach relationships.
create or replace function public.is_coach_of(target_trainee uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.coach_trainees where coach_id = auth.uid() and trainee_id = target_trainee and active); $$;
create or replace function public.has_role(target_user uuid, required_role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = target_user and role = required_role); $$;
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Prevent a trainee from promoting their own profile to coach through self-service UPDATE.
create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security invoker set search_path = public
as $
begin
  if old.role is distinct from new.role
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Profile role can only be changed by an administrator';
  end if;
  return new;
end;
$;
create trigger protect_profile_role
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

alter table public.profiles enable row level security;
alter table public.coach_trainees enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.check_ins enable row level security;

create policy "profile self or coach read" on public.profiles for select using (id = auth.uid() or public.is_coach_of(id));
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "coach trainee links read" on public.coach_trainees for select using (coach_id = auth.uid() or trainee_id = auth.uid());
create policy "coach create trainee links" on public.coach_trainees for insert with check (coach_id = auth.uid() and public.has_role(coach_id, 'coach') and public.has_role(trainee_id, 'trainee'));
create policy "coach remove trainee links" on public.coach_trainees for delete using (coach_id = auth.uid());

create policy "assignment read" on public.assignments for select using (coach_id = auth.uid() or (trainee_id = auth.uid() and status in ('published','completed')));
create policy "coach create assignments" on public.assignments for insert with check (coach_id = auth.uid() and public.has_role(coach_id, 'coach') and (trainee_id is null or public.is_coach_of(trainee_id)));
create policy "coach update assignments" on public.assignments for update using (coach_id = auth.uid()) with check (coach_id = auth.uid() and (trainee_id is null or public.is_coach_of(trainee_id)));
create policy "coach delete assignments" on public.assignments for delete using (coach_id = auth.uid());

create policy "exercise read through assignment" on public.assignment_exercises for select using (
  exists(select 1 from public.assignments a where a.id = assignment_id and (a.coach_id = auth.uid() or (a.trainee_id = auth.uid() and a.status in ('published','completed'))))
);
create policy "coach manage exercises" on public.assignment_exercises for all
using (exists(select 1 from public.assignments a where a.id = assignment_id and a.coach_id = auth.uid()))
with check (exists(select 1 from public.assignments a where a.id = assignment_id and a.coach_id = auth.uid()));

create policy "workout logs visible to trainee and coach" on public.workout_logs for select using (trainee_id = auth.uid() or public.is_coach_of(trainee_id));
create policy "trainee create logs for own assignment" on public.workout_logs for insert with check (
  trainee_id = auth.uid() and exists (
    select 1 from public.assignment_exercises e join public.assignments a on a.id = e.assignment_id
    where e.id = assignment_exercise_id and a.trainee_id = auth.uid() and a.status in ('published','completed')
  )
);
create policy "trainee update own logs" on public.workout_logs for update using (trainee_id = auth.uid()) with check (
  trainee_id = auth.uid() and exists (
    select 1 from public.assignment_exercises e join public.assignments a on a.id = e.assignment_id
    where e.id = assignment_exercise_id and a.trainee_id = auth.uid()
  )
);
create policy "checkins visible to trainee and coach" on public.check_ins for select using (trainee_id = auth.uid() or public.is_coach_of(trainee_id));
create policy "trainee submit own checkins" on public.check_ins for insert with check (trainee_id = auth.uid());
create policy "trainee update own checkins" on public.check_ins for update using (trainee_id = auth.uid()) with check (trainee_id = auth.uid());

-- Provisioning: create Coach Ice in Supabase Auth, then create a profiles row in SQL Editor:
-- insert into public.profiles (id, full_name, role) values ('<AUTH_USER_UUID>', 'Coach Ice', 'coach');
-- Create trainee Auth users and profiles, then link each through coach_trainees.
