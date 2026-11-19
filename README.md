# ICE COACHING SYSTEM

MVP starter for Coach Ice: Coach Dashboard, Trainee Portal and Monthly / Weekly / Daily training assignments.

## Stack
- Next.js 15 + React 19 + TypeScript
- Supabase Auth + PostgreSQL + Row Level Security (schema included)
- Vercel-ready; GitHub Actions build workflow

## Included MVP
- Responsive Coach dashboard and Trainee portal
- Coach / Trainee view switch for UI preview
- Assignment overview with Monthly / Weekly / Daily filters
- Create assignment draft interaction
- Trainee workout checklist interaction
- Trainee overview with illustrative sample metrics and coach note
- Supabase SQL schema: profiles, coach-trainee links, assignments, exercise prescriptions, workout logs and check-ins
- RLS policies for coach/trainee data isolation

> Current UI uses illustrative local sample data. Authentication and live Supabase CRUD are not wired yet. Do not treat the sample client names or metrics as real records.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `npm install` and `npm run dev`.
4. Open http://localhost:3000.

The UI can be previewed without Supabase credentials; live data requires Supabase integration.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Create Coach Ice in Authentication > Users.
4. Create the matching `profiles` row, then promote its role to `coach` using the SQL comment at the end of the schema.
5. Create trainee Auth users and corresponding profiles; link each trainee through `coach_trainees`.
6. Set the two public Supabase environment variables locally and in Vercel.

Never expose the Supabase service-role key in browser code or commit secrets.

## Data model
- `profiles`: authenticated user profile and role
- `coach_trainees`: coach-to-trainee relationship
- `assignments`: monthly, weekly or daily plan with date range
- `assignment_exercises`: exercise prescription (sets, reps, weight, rest, RIR)
- `workout_logs`: trainee performed sets
- `check_ins`: bodyweight, sleep, energy, soreness and notes

## Deployment
Connect this repository to Vercel, add the Supabase environment variables, and deploy. GitHub Actions runs a production build on pushes to `main` and pull requests.

## Next implementation tasks
- Supabase Auth sign-in/sign-out and protected routes
- Replace local arrays with Supabase queries and mutations
- Trainee invitation/onboarding flow
- Assignment detail editor and exercise library
- Real check-in review, progress charts and messaging
- Automated tests and security review before production use
