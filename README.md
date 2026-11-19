# ICE COACHING SYSTEM

MVP starter for Coach Ice: Coach Dashboard, Trainee Portal and Monthly / Weekly / Daily training assignments.

## Stack
- Next.js 15 + React 19 + TypeScript
- Supabase Auth + PostgreSQL + Row Level Security
- GitHub Actions build workflow; Vercel-ready

## Included MVP
- Responsive Coach dashboard and Trainee portal
- Coach / Trainee view switch for UI preview
- Assignment overview with Monthly / Weekly / Daily filters
- Create assignment draft interaction
- Trainee workout checklist interaction
- Supabase SQL schema for profiles, coach-trainee links, assignments, exercise prescriptions, workout logs and check-ins
- Row Level Security policies for trainee data isolation

> The screens currently use illustrative sample data. Supabase authentication and live CRUD wiring are not complete. Do not treat sample names, weights or metrics as real client records.

## Run locally
1. Install Node.js 20+.
2. Run `cd ice-coaching-system`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable/anon key.
4. Run `npm install` and `npm run dev`.
5. Open http://localhost:3000.

## Supabase setup
1. Create a Supabase project.
2. Run `ice-coaching-system/supabase/schema.sql` in the SQL Editor.
3. Create Coach Ice in Authentication > Users.
4. Insert a matching `profiles` row with role `coach` using the provisioning SQL comment at the end of the schema.
5. Create trainee Auth users and profile rows, then add `coach_trainees` records.
6. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally and in Vercel.

Never expose the Supabase service-role key in browser code or commit secrets.

## Data model
- `profiles`: user profile and role
- `coach_trainees`: coach-to-trainee relationship
- `assignments`: monthly, weekly or daily plan and date range
- `assignment_exercises`: exercise prescription (sets, reps, weight, rest, RIR)
- `workout_logs`: performed sets
- `check_ins`: bodyweight, sleep, energy, soreness and notes

## Deployment
The GitHub Actions workflow builds from the `ice-coaching-system` directory. Connect the repository to Vercel with that directory as the Root Directory, then add the two public Supabase environment variables.

## Before production
- Implement Supabase Auth and protected routes
- Replace local sample data with Supabase queries and mutations
- Add trainee invitation/onboarding
- Build assignment detail editor and exercise library
- Add real check-in review, progress charts and messaging
- Add automated tests, audit logging and security review
