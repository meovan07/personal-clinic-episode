# Sổ bệnh án

A private website for storing the medical records of two people: cases (bệnh án), visits, documents (photos and PDFs), medications and to-dos. The interface is in Vietnamese.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind CSS 4

## Roadmap

- [x] **Phase 1 – Storage:** people, cases, visits, multi-page document upload (with duplicate detection), medications, to-dos
- [ ] **Phase 2 – AI extraction:** read uploaded PDFs/photos, extract results, review screen, test catalog
- [ ] **Phase 3 – Insights:** per-test charts, "what changed" summaries
- [ ] **Phase 4 – Extras:** reminders, a one-page summary for doctors, search

## Data model

`people` → `cases` → `visits` → `documents` (→ `document_files`, one row per page) / `observations` / `medications`, plus `action_items` and `ai_summaries`. Every table has row-level security, and only accounts listed in `members` can read or write. Original files live in the private `documents` storage bucket and are only served through signed URLs that expire after 1 hour. See `supabase/migrations/`.

## Local development

Requires Docker Desktop.

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage in Docker
npx supabase db reset       # apply migrations + supabase/seed.sql (2 test accounts)
cp .env.example .env.local  # use the API URL + publishable key printed by `npx supabase status`
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
6. **Deploy to Vercel:** import this GitHub repo and set these environment variables (from Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
7. Open the site on your phone and log in. Adding it to your home screen makes it feel like an app.
