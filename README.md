# Sổ bệnh án

A private website for storing the medical records of two people: cases (bệnh án), visits, documents (photos and PDFs), medications and to-dos. The interface is in Vietnamese.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · OpenAI (document reading) · Tailwind CSS 4

## Roadmap

- [x] **Phase 1 – Storage:** people, cases, visits, multi-page document upload (with duplicate detection), medications, to-dos
- [x] **Phase 2 – AI extraction:** read uploaded PDFs/photos, extract results, review screen, test catalog
- [x] **Phase 3 – Insights:** per-test charts, "what changed" summaries
- [x] **Phase 4 – Quick add:** a single "+" upload; AI matches the document to a person and bệnh án instead of manual selection
- [x] **Phase 5 – Sổ tiêm chủng:** vaccination history per person (vaccine, dose, date given, next due date), read from scanned vaccination certificates the same way lab results are today
- [ ] **Phase 6 – Extras:** reminders, a one-page summary for doctors, search

## Data model

`people` → `cases` → `visits` → `documents` (→ `document_files`, one row per page) / `observations` / `medications`, plus `vaccinations` (per person, from confirmed certificates or added by hand), `action_items` and `ai_summaries`. Every table has row-level security, and only accounts listed in `members` can read or write. Original files live in the private `documents` storage bucket and are only served through signed URLs that expire after 1 hour. See `supabase/migrations/`.

## How AI extraction works

1. Upload the pages of one document (PDF or photos), then press **🤖 Đọc bằng AI** (read with AI).
2. The server sends the files to OpenAI (`src/lib/ai/extract.ts`) with a strict JSON schema. The model copies names, values, units and ranges exactly as printed. It never converts anything. Requests use `store: false`.
3. The **review screen** (`/documents/[id]/review`) shows the original next to editable fields. Nothing is saved until you press **Xác nhận** (confirm).
4. On confirm, `src/lib/normalize.ts` does the maths in code, not in the LLM:
   - matches test names to `test_catalog` (aliases, with or without diacritics)
   - converts units using `unit_conversions`, e.g. mg/dL → mmol/L (the printed value is kept in `raw_value` / `raw_unit`)
   - reads reference ranges (`3,9 - 6,4`, `< 5.18`, `(≤ 40)`) and recomputes high/low
   - turns the doctor's advice and the follow-up date into to-dos
   - saves vaccination doses (skipping doses already recorded from an earlier photo of the same card) and turns a future next-dose date into a to-do

   Confirming again replaces the rows created from that document.

To add a test to the catalog, insert a row into `test_catalog` (and `unit_conversions` if labs print it in another unit). Run `npm test` for the normalization tests.

## Local development

Requires Docker Desktop.

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage in Docker
npx supabase db reset       # apply migrations + supabase/seed.sql (2 test accounts)
cp .env.example .env.local  # use the API URL + publishable key printed by `npx supabase status`, plus your OpenAI key
npm run dev
```

The test accounts are listed in `supabase/seed.sql`. They exist only in the local database.

## Deploying (Supabase + Vercel, free tiers)

1. **Create a Supabase project** at supabase.com. Pick the Singapore region, which is closest to Vietnam.
2. **Push the schema:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Turn off public sign-up:** Authentication → Sign In / Providers → turn off "Allow new users to sign up".
4. **Create the two accounts:** Authentication → Users → Add user → Create new user (tick "Auto Confirm User").
5. **Grant access.** In the SQL Editor, run:
   ```sql
   insert into public.members (user_id, display_name)
   select id, 'Anh' from auth.users where email = 'your@email.com'
   union all
   select id, 'Em'  from auth.users where email = 'her@email.com';
   ```
6. **Deploy to Vercel:** import this GitHub repo and set these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from Supabase → Project Settings → API)
   - `OPENAI_API_KEY` (server-only; set a monthly budget at platform.openai.com → Limits)
7. Open the site on your phone and log in. Adding it to your home screen makes it feel like an app.

## Claude Code setup

`.mcp.json` configures the Supabase and Vercel MCP servers for this project. The first time you use them, run `/mcp` in an interactive `claude` session and sign in to each. `.claude/skills/` contains Supabase's official agent skills.
