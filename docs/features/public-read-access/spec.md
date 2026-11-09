# Spec: Public read access to Tổng quan and Lần khám

From: intent.md (Hung). Status: approved. Approved: 2026-11-09.

"Anon" below means a request with no Supabase session. Example IDs: person `P` (exists), visit `V` (belongs to `P`, has 2 document files), case `C` (belongs to `P`).

## Requirements

- R1. The proxy lets anon requests through only for the public routes; everything else still redirects to `/login`.
  - Given anon, when GET `/people/P`, `/people/P?tab=tong-quan`, `/people/P?tab=lan-kham`, `/visits/V` or `/cases/C`, then 200.
  - Given anon, when GET `/`, `/people/P?tab=chi-so`, `/people/P?tab=tiem-chung`, `/people/P/summary`, `/people/P/vaccinations`, `/people/P/edit`, `/visits`, `/visits/new`, `/visits/V/edit`, `/cases/new`, `/cases/C/edit`, `/settings`, `/inbox/X/review` or `/documents/X/review`, then a redirect to `/login?next=<original path+query>`.
  - Boundary: `/people/P?tab=unknown` resolves to Tổng quan for members today, so for anon it is 200 with Tổng quan; `/visits/V/` (trailing slash) behaves like `/visits/V`.
  - Given a member session, then every route behaves exactly as today.
- R2. Anon cannot write. All server actions in `src/app/actions.ts` and `POST /api/chat` reject anon with no database change.
  - Given anon, when posting any server action (for example `deleteVisit` with `V`), then the request fails and `V` still exists. When POSTing `/api/chat`, then 401.
- R3. Anon data comes only from read-only `SECURITY DEFINER` RPCs, one per public page (`public_person`, `public_visit`, `public_case`), each taking an id and returning only the fields that page shows. Tables keep members-only RLS.
  - Given anon and the publishable key, when REST `select * from visits` (or `people`, `observations`, `documents`, `document_files`, `ai_summaries`), then 0 rows.
  - Given anon, when `rpc('public_visit', {id: V})`, then V's visit, documents and files, medications, to-dos, observations and vaccinations. When the id is random, then `null`.
  - The RPCs never return `inbox_*`, `chat_*`, `agent_*`, `members`, `push_subscriptions` or AI extraction internals (`extraction_error`, raw JSON).
- R4. Person page for anon: header (name and basic info), only the "Tổng quan" and "Lần khám" tabs, and inside Tổng quan only the attention list, latest results, bệnh án and the latest saved AI summary.
  - Given anon on `/people/P`, then no Chỉ số or Tiêm chủng tabs, no to-do list, no "Tóm tắt bằng AI" / "Tóm tắt lại" button, no "Xem tất cả" link into Chỉ số, no edit link, and no "+ Thêm lần khám".
  - Boundary: P has no AI summary, then the summary section is not shown (no empty-state button).
- R5. Visit page for anon: the same content members see (results, medications, to-dos, vaccinations, documents with their images), with no controls.
  - Given anon on `/visits/V`, then both document images render from signed URLs, and there is no uploader, AI-read button, edit or delete, "add medication", or to-do checkbox and edit control.
  - The link to case `C` works (R6). The link back to the person goes to `/people/P?tab=lan-kham`.
- R6. Case page for anon: read-only, with visits, followed results and open to-dos as members see them, but no edit or delete.
- R7. Document files: anon can view only the files of the visit page being rendered, through short-lived signed URLs (1 hour, as for members), and cannot list or download other objects in the `documents` bucket.
  - Given anon, when the storage API lists the `documents` bucket, then 0 objects. Given an `inbox_files` path, then no access.
- R8. Member-only chrome is hidden for anon: person nav and tab bar, "+" quick add, search (header button, `/` and Ctrl/⌘+K), assistant chat, settings, install hint, and the notification prompt.
  - Given anon on any public page, then pressing `/` does nothing and no chat launcher is present.
- R9. The header shows "Đăng nhập" for anon, linking to `/login?next=<current path+query>`. After a successful sign-in the user lands on `next` if it is a same-origin relative path, otherwise on `/`.
  - Boundary: `next=//evil.com` or `next=https://evil.com` → `/`.
- R10. Public pages are indexable: no `noindex`, and no robots rule blocking `/people`, `/visits` or `/cases`.

## Design

- **Proxy** (`src/proxy.ts`): add an allow-list check (path regex plus a `tab` check for `/people/[id]`) and keep refreshing the session for everyone. Add `next` to the login redirect. Pure helper `isPublicPath(pathname, search)` in `src/lib/public-routes.ts` (unit tested).
- **Membership in pages**: a `getViewer()` helper returns `{ isMember }` (reusing the layout's `members` check). Pages branch on `isMember`: members keep today's queries untouched, anon calls the RPC.
- **DB**: one migration adding `public_person(uuid)`, `public_visit(uuid)`, `public_case(uuid)` as `SECURITY DEFINER`, `set search_path = ''`, `stable`, returning `jsonb`, `grant execute ... to anon, authenticated`. Shapes mirror the current page selects. Update `database.types.ts` by hand.
- **Files**: the mechanism for signing anon file URLs is chosen in plan.md Approach (it needs either a narrowly scoped server credential or a scoped storage path; R7 fixes the outcome).
- **Writes**: server actions get a shared `requireMember()` guard at the top of each, if they lack one; `/api/chat` checks for a member.
- **UI**: `AppShell` and pages receive `isMember` and skip rendering member-only parts; no new components except the "Đăng nhập" link.
- **Login**: `signIn` reads `next` from the form (hidden input set from the search param) and validates it as a relative path.

## Errors

| Case | Response |
| :---- | :---- |
| Anon opens a public route with an unknown id | RPC returns `null` → `notFound()` (404), same as members |
| Anon opens a locked route | 307 to `/login?next=…` |
| Anon calls a server action | Throws / returns the existing "not signed in" error; no write |
| Anon POSTs `/api/chat` | 401 |
| Signing a file fails | Image shown as a "Không tải được ảnh" placeholder; the page still renders |
| Invalid `next` after login | Redirect to `/` |

## How each constraint in the intent is met

| Constraint | Met by |
| :---- | :---- |
| Real data public and indexable by choice | R1, R10 |
| No `to anon` table policies, no service key in page queries | R3, R7 |
| No writes for anon | R2 |
| Member-only UI hidden | R4, R5, R6, R8 |
| Next.js 16 proxy | Design: proxy |

## Open questions from the intent

- Signing file URLs without opening the bucket: outcome fixed by R7; the mechanism is decided in plan.md Approach.
- Whether shown content includes data from locked areas: anon sees exactly what members see on those pages (R4–R6). The AI summary and the latest results on Tổng quan can mention trends that Chỉ số shows in full. Accepted as part of "overview is public".

## Areas of concern

- The to-do rule differs by page: they're hidden on Tổng quan (R4) but shown on the visit and case pages (R5, R6), following the grill answers.
- Visit and case UUIDs are the only "secret", and with indexing allowed they will be discovered.

## Decisions

- Public scope, indexing and hidden UI: analysis R1–R10. Decided by Hung, 2026-11-09.
