# Development

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

There are two ways to point it at a database:

- **The hosted Supabase project (how we work day to day).** Put the project's URL and publishable key in `.env.local`. You sign in with your real account and see the real records. **Anything you save or approve locally is saved for real**, so test changes with clearly labelled test data and clean it up.
- **A local Supabase in Docker** (needs Docker Desktop), for experiments that shouldn't touch real data:
  ```bash
  npx supabase start      # local Postgres/Auth/Storage
  npx supabase db reset   # applies the migrations + supabase/seed.sql (2 test accounts, local only)
  ```
  Use the API URL and publishable key printed by `npx supabase status`. The test accounts are listed in `supabase/seed.sql`.

## Environment variables

| Variable | Where | What |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Supabase → Project Settings → API |
| `OPENAI_API_KEY` | server only | Never prefix with `NEXT_PUBLIC_`. Set a monthly budget at platform.openai.com → Limits |
| `OPENAI_MODEL` | server, optional | Model for document reading (default `gpt-6-luna`) and for the health summary and to-do wording (default `gpt-5.5`). See [ai.md](ai.md#models) |
| `CHAT_MODEL` | server, optional | Model for the assistant (default `gpt-6-luna`) |
| `CRON_SECRET` | server | Lets only Vercel Cron call `/api/keep-alive` and `/api/reminders`; its SHA-256 is also stored in `private.cron_tokens` (see [Push reminders](#push-reminders)) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | public / server only | Web Push keys, made once with `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | server, optional | Contact for push services; defaults to the site URL |

`.env.local` is gitignored. On Vercel, set the same variables under Settings → Environment Variables.

## Checks

```bash
npx tsc --noEmit   # types
npm run lint       # ESLint
npm test           # unit tests: normalization, vaccinations, calendar, assistant memory and approvals
npm run build      # production build
```

Code is formatted with Prettier at a 120-character line width (`npx prettier --print-width 120 --write <files>`).

## Testing on a phone

Installing to the home screen, push notifications and the real on-screen keyboard need HTTPS on an actual device, so test those on the deployed site (or a Vercel preview). On iPhone: open it in Safari → Share → Thêm vào Màn hình chính, then open it from the new icon. After a deploy, the installed app picks up the new version on its next launch (the service worker is fetched with `updateViaCache: "none"`).

## Database changes

Migrations in `supabase/migrations/` are the source of truth, and only add or change things; data is never dropped by a migration without asking first.

1. Create the file (the redirect stops the CLI from waiting for input):
   ```bash
   npx supabase migration new <name> < /dev/null
   ```
2. Write the SQL. New tables get row-level security with `private.is_member()` like the others.
3. Apply it to the hosted project with `npx supabase db push` (or the Supabase MCP server's `apply_migration`), then check the security advisor for new warnings.
4. Update `src/lib/database.types.ts` (regenerate, or add the new table by hand).

## Deploying

Pushing to `main` deploys to production on Vercel automatically. Apply any new migration before pushing code that needs it.

**Keep-alive.** Supabase pauses free-plan projects after about a week with no activity. `vercel.json` schedules a Vercel Cron job every day at 01:00 UTC (08:00 Vietnam time) that calls `/api/keep-alive`, which makes one request to the database. Set `CRON_SECRET` (any long random string) in Vercel's environment variables so only Vercel can trigger it; without it the route still works but anyone can call it (harmless: it returns no data). If the project does get paused, restore it from the Supabase dashboard.

### Push reminders

After applying the migration `20261002071117_push_reminders.sql`, store the hash of `CRON_SECRET` so the daily job can read its feed (run in the SQL Editor; replace the value with `printf '%s' "$CRON_SECRET" | shasum -a 256`):

```sql
insert into private.cron_tokens (name, token_sha256)
values ('vercel', '<sha256 of CRON_SECRET>')
on conflict (name) do update set token_sha256 = excluded.token_sha256;
```

Changing `CRON_SECRET` means updating this row too. To try the job by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/reminders`.

### Setting up from scratch

1. **Create a Supabase project** at supabase.com, in the Singapore region (closest to Vietnam).
2. **Push the schema:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Turn off public sign-up:** Authentication → Sign In / Providers → turn off "Allow new users to sign up".
4. **Create the two accounts:** Authentication → Users → Add user → Create new user (tick "Auto Confirm User").
5. **Grant access** in the SQL Editor:
   ```sql
   insert into public.members (user_id, display_name)
   select id, 'Anh' from auth.users where email = 'your@email.com'
   union all
   select id, 'Em'  from auth.users where email = 'her@email.com';
   ```
   `display_name` is also how the assistant tells the two members apart.
6. **Deploy to Vercel:** import the GitHub repo and set the environment variables above.
7. Open the site on your phone and log in. Adding it to the Home Screen makes it feel like an app.

## Claude Code setup

`.mcp.json` configures the Supabase and Vercel MCP servers for this project; the first time, run `/mcp` in an interactive `claude` session and sign in to each. `.claude/skills/` holds Supabase's official agent skills, and `.claude/launch.json` defines the dev server for the preview browser.
