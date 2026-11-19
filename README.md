# ICE COACHING SYSTEM

MVP for Coach Ice, backed by the user's existing Google Spreadsheet:
https://docs.google.com/spreadsheets/d/1-1vOU_CbR-grqo0RGnX4UBXS7D7572XgxCpQSMUKUA8/edit

## Stack
- Next.js 15 + React 19 + TypeScript
- Google Sheets as the data store
- Google Apps Script as a private server-side adapter
- Next.js API route proxies requests and keeps the shared secret off the browser
- GitHub Actions CI; Vercel-ready

## MVP features
- Coach and trainee sign-in using email + six-digit PIN
- Coach dashboard showing trainee and assignment counts
- Create and publish Monthly / Weekly / Daily assignments
- Assign plans to one linked trainee
- Add exercises with sets, reps and target weight
- Trainee portal showing their currently active published plan
- Trainee can log completion of prescribed exercises
- Coach can create trainee accounts; temporary PIN is displayed once

## Repository layout
- `ice-coaching-system/`: Next.js app
- `google-apps-script/Code.gs`: Apps Script API and Google Sheets data adapter
- `.github/workflows/ci.yml`: CI build

## 1. Configure the provided Google Sheet
The database adapter is preconfigured for spreadsheet ID `1-1vOU_CbR-grqo0RGnX4UBXS7D7572XgxCpQSMUKUA8`.

1. Sign in to the Google account that has Editor access to that spreadsheet.
2. Open https://script.google.com/home/start and create a standalone Apps Script project.
3. Copy the full contents of `google-apps-script/Code.gs` into `Code.gs`.
4. In Apps Script > Project Settings > Script Properties, add:
   - `ICE_COACH_SHARED_SECRET`: a long random secret (at least 32 characters).
   - `ICE_COACH_EMAIL`: Coach Ice's login email.
   - `ICE_COACH_NAME`: Coach Ice.
   - `ICE_COACH_PIN`: a private six-digit PIN.
5. Run `configureDatabaseSpreadsheet()` once. Review and approve Google permissions. This adds missing tabs and headers to the supplied sheet. If an existing tab has a conflicting header row, the script stops rather than overwriting that tab.
6. Run `provisionCoachIce()` once to create/update the Coach Ice profile.
7. Deploy > New deployment > Web app:
   - Execute as: Me
   - Who has access: Anyone
8. Copy the Web app URL ending in `/exec`. Do not paste it into frontend code.

The Apps Script web app is public at the URL level, but every API POST requires the shared secret which is sent only by the Next.js server. Keep the secret private. Do not publish it in Google Sheets cells, GitHub, or browser code.

## 2. Configure Next.js locally or in Vercel
Set these server environment variables:
- `GOOGLE_APPS_SCRIPT_URL`: the Apps Script Web app URL ending in `/exec`.
- `GOOGLE_SHEETS_SHARED_SECRET`: exactly the same value as Apps Script Script Property `ICE_COACH_SHARED_SECRET`.

No Supabase variables or service-role key are used by this version.

## 3. Run locally
1. Install Node.js 20+.
2. Run `cd ice-coaching-system`.
3. Copy `.env.example` to `.env.local` and set the two values above.
4. Run `npm install` and `npm run dev`.
5. Open http://localhost:3000.

## 4. Create trainee accounts
Sign in as Coach Ice, choose **Add trainee**, and enter the trainee's name and email. The system generates a temporary six-digit PIN. Share it with the trainee through a private channel. The trainee signs in using their email + PIN.

## Data tabs created/used
- `Profiles`: email, name, role, PIN hash, coach email, active state
- `Assignments`: monthly/weekly/daily plans and date ranges
- `Exercises`: exercise prescriptions, sets, reps, target weight and coaching cues
- `WorkoutLogs`: completed exercise logs
- `CheckIns`: reserved for trainee check-in records

The Apps Script adapter creates the tabs and exact header rows on first authenticated request / setup. Existing tabs with matching names must use the expected header order.

## Security and operational notes
- Only a salted-by-secret HMAC of each PIN is stored in the sheet; plaintext PINs are not stored.
- App sessions are signed and expire after 12 hours.
- The shared server secret is never sent to the browser.
- Apps Script runs as its owner, so the Google account deploying the Web App must retain Editor access to the spreadsheet.
- Anyone who can edit the spreadsheet can read or change coaching records. Share it only with trusted administrators.
- Google Sheets is suitable for a small MVP; it is not a high-concurrency transactional database. Use versioned backups and avoid simultaneous bulk edits to the same rows.
- This MVP does not yet include password reset, invitation emails, check-in submission UI, body measurements charts, per-set logging, messaging, audit log or automated conflict resolution. Review security and backup procedures before production use.

## Deployment
Connect this GitHub repository to Vercel and set the Root Directory to `ice-coaching-system`. Add `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_SHEETS_SHARED_SECRET` to Vercel Environment Variables, then deploy. GitHub Actions builds on pushes and pull requests.

## CI
The `ICE Coaching System CI` workflow runs `npm install` and `npm run build` from the app directory.
