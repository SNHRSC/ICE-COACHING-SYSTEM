# ICE COACHING SYSTEM

MVP starter for Coach Ice: Coach Dashboard, Trainee Portal and Monthly / Weekly / Daily training assignments.

## Stack
- Next.js 15 + React + TypeScript
- Supabase Auth + Postgres + Row Level Security (schema included)
- Vercel-ready; GitHub repository workflow

## Included in this MVP starter
- Responsive Coach dashboard and trainee portal UI
- Coach / Trainee view switch for UI preview
- Assignment list with Monthly / Weekly / Daily filters
- Create assignment draft interaction
- Trainee workout checklist interaction
- Trainee overview with sample metrics and coach note
- Supabase SQL schema with profiles, coach-trainee links, assignments, exercise prescriptions, workout logs and check-ins
- RLS policies for coach/trainee data isolation

> The current dashboard uses clearly illustrative sample data. Live authentication and Supabase CRUD wiring are the next integration step after Supabase project credentials and GitHub connection are available. Do not use sample metrics as real client records.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

The UI runs in preview mode even before Supabase credentials are configured.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication, create the Coach Ice user.
4. Find that user's UUID in Authentication > Users.
5. Run the SQL comment's profile promotion statement, replacing the UUID.
6. Create trainee users and insert `coach_trainees` rows linking the coach to each trainee.
7. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` and to Vercel project environment variables.

Use only the Supabase anon/publishable key in the browser. Never expose the service-role key in frontend code or commit secrets.

## Data model
- `profiles`: authenticated user profile and role
- `coach_trainees`: coach-to-trainee relationship
- `assignments`: monthly, weekly or daily plan header and date range
- `assignment_exercises`: exercise prescription (sets, reps, weight, rest, RIR)
- `workout_logs`: trainee's performed sets
- `check_ins`: bodyweight, sleep, energy, soreness and notes

## Roles and access
RLS is enabled on every application table. Coaches can read and manage their linked trainees' assignments; trainees can read their own assignments and write their own workout logs and check-ins. Profile role changes and initial coach provisioning should be performed by an administrator in Supabase.

## Deployment
After the repository is created and connected to Vercel:
- Push `main` to GitHub.
- Import/link the repository in Vercel.
- Add the two Supabase environment variables.
- Deploy. Each subsequent push to the production branch will trigger a deployment.

## Important next implementation tasks
- Replace sample arrays with Supabase queries and mutations.
- Add Supabase Auth sign-in, sign-out and protected route handling.
- Add trainee invitation/onboarding flow.
- Add assignment detail editor and exercise library.
- Add real check-in review, progress charts and messaging.
- Add automated tests and audit logs before production use.
