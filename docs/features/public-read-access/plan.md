# Plan: Public read access to Tổng quan and Lần khám

From: `docs/features/public-read-access/intent.md` and `spec.md` (R1-R10).

Status: approved
Approved: 2026-11-09
Branch: feat/public-read-access

## Context

Today the proxy and members-only RLS lock everything. The fix: an allow-list in the proxy, read-only RPCs that feed the 3 public pages for anon, an `isMember` switch that hides member UI, and member guards on every write. The one open choice is how anon gets document images: storage signing needs a credential that anon doesn't have, and a `SECURITY DEFINER` function can't sign storage URLs.

## Approach

Options:

| | A. RPCs + server-only secret key that only signs files | B. RPCs + image proxy route | C. Minimal: `to anon` RLS select policies |
| :-- | :-- | :-- | :-- |
| What | Pages call `public_*` RPCs as anon. A new server-only `SUPABASE_SECRET_KEY`, used in exactly one helper, signs the `storage_path`s that `public_visit` returned (1h). | Same RPCs. `<img src="/api/public-file/<file_id>">`: the route asks `public_file(file_id)` for the path, then streams the bytes using the secret key. | Add anon select policies on the ~8 tables and the bucket (scoped to `document_files` paths). Pages keep today's queries. |
| Fit with Goal | Full (R3, R7 met) | Full (R3, R7 met) | Fails R3 (anon REST returns rows) and R7 (anon can list or download every visit file) |
| Complexity | Medium | Medium-high (streaming, caching headers, HEIC) | Low |
| Risk | Secret key on the server: misuse would bypass RLS. Contained to one tiny, tested helper. | Same key. Stable file URLs get indexed and hotlinked, and every image goes through a Vercel function. | Whole tables dumpable with the public key, the opposite of the architecture rule |
| Performance | Same as members today | Extra function hop per image; Vercel bandwidth | Same as today |
| Reversibility | Revert + drop the RPCs + remove the env var | Same as A | Drop the policies |
| Effort | M | M/L | S |
| Pros | Smallest exposure; anon sees exactly the page | No signed URLs in HTML; can revoke instantly | Fastest; no new key |
| Cons | Adds the first secret key; architecture.md needs a narrow, documented exception | More code; costs; images indexable forever | Breaks R3/R7 and the security model |

Recommendation: **A**, because it meets the Goal's "REST returns 0 rows" check and R7 with the least new surface. The secret key is limited to one file and only ever signs paths an RPC has just returned.
Why not the others: A puts expiring signed URLs in the HTML; the user prefers stable proxy URLs (accepting the per-image function cost). C fails the Goal's own check.
Decision: B, chosen by Hung on 2026-11-09.

## How B works

- `public_person(uuid)`, `public_visit(uuid)`, `public_case(uuid)`: `SECURITY DEFINER`, `stable`, `set search_path = ''`, return `jsonb` shaped like today's page selects (R3). `public_visit` returns each file as `{ id, page_no, file_name, mime_type }`, never `storage_path`.
- `public_file(uuid)`: returns `{ storage_path, mime_type }` only for a `document_files` row whose document has a `visit_id` (never `inbox_files`); `null` otherwise. Granted to `anon` and `authenticated`.
- `GET /api/public-file/[id]`: calls `public_file` as the caller, then downloads that one path with `SUPABASE_SECRET_KEY` from `src/lib/supabase/secret.ts` (the only importer of the key; marked `server-only`) and streams it with `Content-Type` from the row, `Cache-Control: public, max-age=3600`, and `X-Robots-Tag` unset (R10). Unknown id → 404. HEIC is sent as-is; the page keeps showing HEIC as a link, as today.
- Members keep today's signed-URL code. Anon `<img>` and links point to `/api/public-file/<id>` (R5, R7).

## Scope

Do not touch: `supabase/migrations/` existing files (add new only), `src/lib/services/`, `src/lib/agent/`, `src/lib/ai/`, `src/lib/normalize.ts`, `src/lib/vaccinations.ts`, `package.json` (no new dependencies; `server-only` ships with Next).
Review budget per MR: 10 files / 400 lines (tests at half weight). Over it -> 3 slices below.
Risky paths: a migration and auth (proxy, login) → slices 1 and 3 need a human merge.

## Slices

| Slice | Tasks | Files | Est. lines | Shippable alone? (flag/how) | Depended on by | MR | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1/3 | T1, T2 | 5 | 260 | yes: RPCs and file route exist, but the proxy still sends anon to /login, so nothing is public yet | 2, 3 | | pending |
| 2/3 | T3, T4, T5 | 9 | 330 | yes: pages gain an anon branch that nobody can reach yet; members unchanged | 3 | | pending |
| 3/3 | T6, T7, T8 | 8 | 220 | yes: opens the routes. Reverting this slice alone locks everything again | none | | pending |

## Files that change

- `supabase/migrations/20261109000000_public_read.sql` (new): the 4 RPCs + grants (T1).
- `src/lib/database.types.ts`: RPC signatures (T1).
- `src/lib/supabase/secret.ts` (new): server-only storage client with `SUPABASE_SECRET_KEY` (T2).
- `src/app/api/public-file/[id]/route.ts` (new): the streaming route (T2).
- `src/lib/public-file.ts` (new) + `src/lib/public-file.test.ts` (new): pure response-building helper and its tests (T2).
- `src/lib/viewer.ts` (new): `getViewer()` → `{ user, isMember }`, cached per request with React `cache` (T3).
- `src/lib/public-data.ts` (new): typed wrappers around the 3 RPCs mapping to the shapes the pages already use (T3).
- `src/app/people/[id]/page.tsx`, `src/app/visits/[id]/page.tsx`, `src/app/cases/[id]/page.tsx`: anon branch + hide controls (T4).
- `src/app/layout.tsx`: header for anon (logo + "Đăng nhập"), no nav, search, settings or chat (T5, R8, R9).
- `src/components/AppShell.tsx`: skip SW push prompt/install hint/chat for anon if it renders them (T5).
- `src/lib/public-routes.ts` (new) + `src/lib/public-routes.test.ts` (new): `isPublicPath(pathname, search)` (T6).
- `src/proxy.ts`: allow-list + `next` on redirect; matcher unchanged except `api/public-file` handled by `isPublicPath` (T6).
- `src/app/login/page.tsx`, `src/app/actions.ts` (`signIn`): honor a safe `next` (T7).
- `src/lib/safe-next.ts` (new) + test: `safeNext(value)` (T7).
- `src/app/actions.ts`: `requireMember()` before any action that calls OpenAI or storage before its first RLS-checked query (T8).
- `docs/architecture.md`, `docs/development.md`, `docs/roadmap.md`: public routes, `SUPABASE_SECRET_KEY`, the security exception, change log (T8).

## Tasks

- [x] T1 Add read-only public RPCs (R3, R7) — verified 2026-11-09 on local Supabase: probe as anon passed (shapes, no storage_path/extraction_error, inbox file → null, unknown ids → null, 0 table rows, 0 storage objects)
  - Acceptance: as anon, `rpc('public_visit', {id: V})` returns V's data without `storage_path`; a random id → `null`; `public_file` on an `inbox_files` id → `null`; REST `select` on `visits` still returns 0 rows.
  - Tests: SQL probe script run against local Supabase (`supabase db reset`), saved in the slice's MR: anon calls for a known id, a random id, an inbox file id.
  - Files: migration, `database.types.ts`
  - Lines (est.): 200
  - Size: M
  - Depends on: none
  - Rollback: down migration `drop function public.public_person, public.public_visit, public.public_case, public.public_file;` (no data change; safe).
- [x] T2 Stream public files through `/api/public-file/[id]` (R7, R10)
  - Acceptance: anon GET with a visit file id → 200 with the right `Content-Type`; unknown/inbox id → 404; the secret key is imported only by `secret.ts` (`grep -rn SUPABASE_SECRET_KEY src` = 1 hit).
  - Tests first: `public-file.test.ts` for the pure helper (null row → 404, row → headers); boundaries: missing mime → `application/octet-stream`.
  - Files: `secret.ts`, route, `public-file.ts`, test
  - Lines (est.): 90
  - Size: S
  - Depends on: T1
  - Rollback: revert; unset `SUPABASE_SECRET_KEY` in Vercel.
- [ ] T3 Add `getViewer()` and public data wrappers (R3)
  - Acceptance: members get `isMember: true`; no session → `false`; wrappers return the same shapes the pages use.
  - Tests first: pure mappers in `public-data.ts` (RPC JSON → page shape), with an empty-visit boundary (no documents, no observations).
  - Files: `viewer.ts`, `public-data.ts`, test
  - Lines (est.): 110
  - Size: S
  - Depends on: T1
- [ ] T4 Render read-only person, visit and case pages for anon (R4, R5, R6)
  - Acceptance: with `isMember=false`: person shows only 2 tabs, Tổng quan without to-dos, the summary button or "Xem tất cả"; no summary → section hidden; visit page shows images via `/api/public-file/<id>` and no uploader, AI-read, edit, delete, add-medication or to-do controls; case page has no edit or delete. Members: pages unchanged.
  - Tests: no component test harness in the repo, so checked by the manual steps below; tab resolution logic is unit tested as `publicTab(tab)` in `public-routes.ts` (T6).
  - Files: 3 pages
  - Lines (est.): 150
  - Size: M
  - Depends on: T3
- [ ] T5 Anon header and shell (R8, R9)
  - Acceptance: anon sees logo + "Đăng nhập" (`/login?next=<path+query>`), no PersonNav/tab bar/search/settings/chat/install hint; `/` key does nothing.
  - Files: `layout.tsx`, `AppShell.tsx`
  - Lines (est.): 50
  - Size: S
  - Depends on: T3
- [ ] T6 Open the public routes in the proxy (R1)
  - Acceptance: matrix in spec R1 passes; locked routes redirect to `/login?next=…`.
  - Tests first: `public-routes.test.ts`, one test per row of the R1 lists, plus `?tab=unknown` → public, trailing slash, `/people/P/summary` → locked, `/api/public-file/<id>` → public, `/api/chat` → locked.
  - Files: `public-routes.ts`, test, `proxy.ts`
  - Lines (est.): 120
  - Size: S
  - Depends on: T4, T5
  - Rollback: revert this commit (everything locked again immediately).
- [ ] T7 Return to `next` after sign-in (R9)
  - Acceptance: sign in from `/login?next=/visits/V` → lands on `/visits/V`; `next=//evil.com` or `https://evil.com` → `/`.
  - Tests first: `safe-next.test.ts` with `/visits/V`, `/people/P?tab=lan-kham`, `//evil.com`, `https://evil.com`, `/\evil.com`, empty.
  - Files: `safe-next.ts`, test, `login/page.tsx`, `actions.ts` (signIn)
  - Lines (est.): 60
  - Size: S
  - Depends on: none
  - Rollback: revert.
- [ ] T8 Guard writes and update docs (R2)
  - Acceptance: every exported action in `actions.ts` either starts with `requireMember()` or does nothing before an RLS-checked write (listed in the MR); anon `/api/chat` → 401 (today it checks `getUser`, confirm the status); docs describe the public routes, the secret key's single use, and the changelog entry.
  - Files: `actions.ts`, `api/chat/route.ts` (only if not 401), 3 docs
  - Lines (est.): 60
  - Size: S
  - Depends on: T6

## Risks

- **Riskiest task: T2.** The secret key bypasses RLS. Mitigation: one `server-only` module, used only to download a path that `public_file` just returned for the caller, never a path from the request; a grep check in the acceptance criteria.
- T6 opens real medical data to the internet with indexing (user decision R1/R10). Slice 3 merges last so slices 1-2 can be checked first.
- T4: missing a control (for example a `ConfirmForm` delete) leaves a visible button; the server still rejects it (RLS + T8). The manual check lists every control.
- Bandwidth: images go through Vercel functions; `Cache-Control` limits repeats.

## Proof (verification)

Unit (`npm test`): `public-routes.test.ts`, `safe-next.test.ts`, `public-file.test.ts`, `public-data.test.ts`.

Integration (local Supabase, publishable key, no session):
- REST `select` on `visits`, `people`, `observations`, `documents`, `document_files`, `ai_summaries` → `[]`.
- `rpc` calls for known and random ids; `public_file` with an inbox file id → `null`.
- Storage list on `documents` → `[]`.

Checks: `npm test`, `npx tsc --noEmit`, `npm run lint`, with output shown.

Manual (private window, then signed in):
- Run the intent's Done-when list: 4 public URLs return 200 with images; `/`, `?tab=chi-so`, `/settings`, `/visits/new` redirect to `/login?next=…`.
- Signed in as a member: all 4 tabs, edit buttons, search and chat as before.
- Sign in from a `next` link → back on that page.
