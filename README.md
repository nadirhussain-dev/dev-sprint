# DevSprint 60

A 60-day Mid → Senior Full-Stack Engineer interview preparation tracker. It tells you exactly what to study each day, tracks every hour, keeps an honest streak, brings weak topics back on a spaced schedule, and measures readiness by what you can **demonstrate** — not by how many boxes you ticked.

**Stack:** Next.js 15 (App Router, Server Components, Server Actions) · TypeScript (strict) · Tailwind CSS 4 · Radix/shadcn-style UI · Supabase (Auth, Postgres, RLS, Realtime, Storage) · Zod · React Hook Form · Zustand · Recharts · Web Push (VAPID) · PWA.

---

## What's inside

| Area | What it does |
|---|---|
| **Today** (`/dashboard`) | Day X of 60, what's left today, morning/evening tasks, streak-at-risk warning, study timer, revision due, upcoming days/mocks/milestones, heatmap |
| **Roadmap** (`/roadmap`, `/roadmap/day/[day]`) | All 60 days across 9 phases. Each day: objectives, interview questions, coding assignments, outcomes, morning + evening tasks (240 min), notes, custom tasks, evidence |
| **Calendar** (`/calendar`) | Plan days mapped to real dates, completion, streak days, missed days, mock days |
| **Revision** (`/revision`) | Spaced repetition (1 → 3 → 7 → 14 → 30 days) for anything marked *Needs revision* or scored < 60 |
| **Simulator** (`/simulator`) | Random questions from topics you've studied; answer, then score against the rubric. Also records scored mock interviews |
| **Question bank** (`/questions`) | 48 questions across 16 categories with short answer, explanation, code, real-world example, follow-ups; reveal-to-test, favorites, personal answers |
| **Coding** (`/coding`) | 26 challenges across 13 categories with hints, solutions, complexity; hint-free solves tracked separately. Code is **not** executed in the browser |
| **System design** (`/system-design`) | 10 designs (requirements, API, schema, layered architecture, scaling, caching, security, failures, trade-offs) + notes + self-review |
| **Project** (`/projects`) | 12 milestones for the Service Booking Platform, with tasks, notes and **evidence** (GitHub link, demo, screenshot, explanation) |
| **Analytics** (`/analytics`) | Readiness score with per-area breakdown, daily/weekly study charts, progress by tech and phase, weekly reports |
| **Settings** (`/settings`) | Profile, schedule, timezone, streak minimum, all six reminders, push enablement, app install |

### Your five recommended features
1. **Daily accountability** — the dashboard banner shows required tasks left, the next task, and whether today's streak is earned.
2. **Revision engine** — *Needs revision* on any task/question/challenge/design (or a simulator score < 60) schedules it; reviews move it up or reset it.
3. **Interview simulator** — random questions from completed topics; rubric-based scoring (80% key points covered, 20% clarity).
4. **Project evidence** — attach GitHub links, demo links, screenshots (private storage) and explanations to practical tasks and milestones.
5. **Honest readiness** — task completion is shown as *coverage* only. Each area scores from evidence, discounted until you have enough attempts. 90% of tasks ticked with no assessments ≈ 0% readiness.

### Rules that keep progress honest
- **Streak day** = all of today's required tasks done **or** `streak_min_minutes` (default 120) of **timed** study, evaluated in your timezone.
- Streak rows are written only by the database function `refresh_today()`, only for the user's **current** local date. Finishing an old day's tasks later never creates a past streak day.
- Timer start/pause/stop and "verified" minutes run in SQL with the database clock. One active timer per user across all devices; a forgotten timer caps at 5 hours.
- Manual time requires confirmation and counts toward hours, **not** toward verified streak time.
- Future days are never "missed". A day is complete only when all its required tasks are complete.

---

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in order (`supabase/migrations/*.sql`):
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`, **or**
   - **SQL editor:** paste and run each file in order (`001_schema`, `002_logic_and_rls`, `003_content`).
3. **Auth → Providers → Email:** keep enabled. (Instant mode doesn't send emails; magic-link mode does.)
4. **Auth → URL configuration:** set Site URL to your app URL and add `<your-url>/auth/confirm` to redirect URLs.

### 2. Environment
```bash
cp .env.example .env.local
```
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used for instant sign-in and the reminder cron. Never expose it |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in (e.g. yours) |
| `AUTH_MODE` | `instant` (default): type your email, you're in. `magiclink`: emails a one-time link |
| `NEXT_PUBLIC_SITE_URL` | Your app URL (used for magic-link redirects) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push — generate with `npm run vapid` |
| `CRON_SECRET` | Long random string the scheduler sends as `Authorization: Bearer …` |

> **About email-only sign-in:** in `instant` mode anyone who knows an allow-listed email can open the app. That's fine on your machine. **If you deploy publicly, set `AUTH_MODE=magiclink`** so sign-in requires clicking a link sent to your inbox — still no password. Either way, data is protected per user by Row Level Security.

### 3. Run
```bash
npm install
npm run dev        # http://localhost:3000
```
Sign in with your allow-listed email → onboarding (name, start date, timezone, hours, reminders) → dashboard.

### 4. Background push reminders (optional)
In-app reminders work with no setup: whenever you open the app, any reminder whose time has passed today appears in the bell. For notifications when the app is closed:

1. Set the VAPID keys, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, and deploy over HTTPS.
2. In **Settings → Notifications**, click *Enable push on this device*, then *Send test*.
3. Call `/api/cron/reminders` every 15 minutes. With Supabase `pg_cron` + `pg_net` (enable both under Database → Extensions):
   ```sql
   select cron.schedule('devsprint-reminders', '*/15 * * * *', $$
     select net.http_post(
       url := 'https://YOUR-APP-URL/api/cron/reminders',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
     );
   $$);
   ```
   Any external scheduler (cron-job.org, GitHub Actions, a server crontab) calling the same URL with the bearer header works too.

On iPhone, web push only works after **Add to Home Screen** (iOS 16.4+).

### 5. Install as an app
Open the deployed site and use *Install app* (Chrome/Edge) or *Share → Add to Home Screen* (Safari), or the button in Settings.

---

## Development

```bash
npm run typecheck     # tsc --noEmit (strict)
npm run lint          # eslint
npm test              # vitest: domain logic + all migrations executed on PGlite (real Postgres in WASM)
npm run build
npm run seed:generate # regenerate supabase/migrations/003_content.sql from /content
```

The SQL tests run every migration on an in-process Postgres and verify: 60 days × 240 minutes, RLS isolation between users, users can't forge streak rows or timer logs, overlapping timers are rejected, the 5-hour cap, and that a day completes only when every required task is done.

### Editing the curriculum
Content lives in `/content` (`curriculum.ts`, `questions.ts`, `challenges.ts`, `system-design.ts`, `milestones.ts`). Edit, run `npm run seed:generate`, and re-apply the content migration. IDs are deterministic and the SQL upserts, so your progress is preserved.

### Project structure
```
content/                 Curriculum + question/challenge/design/milestone content (single source of truth)
scripts/                 Seed SQL generator, icon generator
supabase/migrations/     Schema, RLS + trusted SQL functions, generated content
supabase/tests/          Migration tests on PGlite
src/app/(app)/           Signed-in pages (dashboard, roadmap, simulator, …)
src/app/actions/         Server actions (Zod-validated, run under the user's RLS session)
src/app/api/             Push test + reminder cron
src/lib/domain/          Pure, unit-tested logic: dates, streaks, readiness, revision, reminders, scoring
src/lib/data/            Server-side data loaders
src/components/          UI
public/sw.js             Service worker (static assets only — never caches user data)
```

### Offline behavior
The service worker caches only static build assets, icons and the offline page — never authenticated HTML or Supabase responses. If the app is open and you lose connection, task check-offs are queued locally and replayed on reconnect. If the same task changed on another device meanwhile, you're asked which version to keep instead of silently overwriting.

---

Readiness scores are an internal preparation indicator. They don't guarantee interview results.
