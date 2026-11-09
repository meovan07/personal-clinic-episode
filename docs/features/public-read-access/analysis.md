# Analysis: Public read access to Tổng quan and Lần khám

Ticket: user request in chat. Analyzed: 2026-11-09. Status: grilled.

## Ticket

"I want the page information, like the "Lần khám" or even the overview can access from the anonymous, the rest will disable only enable when authenticated."

## What it asks

Signed-out visitors can read a person's Tổng quan and Lần khám (including visit and case details and document files). Everything else (other tabs, home, editing, uploads, assistant, search, settings) stays members-only and is hidden from anonymous visitors.

## What's ambiguous

Resolved in the grill log below.

## Ticket validity

Verdict: valid

Evidence:
- Everything is login-only today: `src/proxy.ts` redirects every unauthenticated request to `/login`; every table has a `members only` RLS policy for `authenticated` (`supabase/migrations/20260928090157_private_membership_check.sql:27`).
- The tabs exist: `src/app/people/[id]/page.tsx:26-29` (`tong-quan`, `chi-so`, `lan-kham`, `tiem-chung`).

Ticket comment: not needed.

## Questions

None left.

## Assumptions

none

## Priority

medium. Reason: new capability for one household app; the main risk is privacy, because real medical data goes public and indexable by explicit choice.

## First step

Write the plan: a proxy allow-list for the public routes, read-only `SECURITY DEFINER` RPCs that return exactly what the public pages show, and an `isMember` switch in the pages that hides member-only UI.

## Decisions (rules that now hold)

- R1: Public means anyone with the URL. No token or share link.
- R2: Public routes: `/people/[id]` (only `?tab=tong-quan` and `?tab=lan-kham`), `/visits/[id]`, `/cases/[id]`. All other routes, including `/`, still redirect to `/login`.
- R3: On Tổng quan, anonymous visitors see the attention list, latest results, bệnh án, and the latest saved AI summary. To-dos and the "Tóm tắt" button are hidden.
- R4: Lần khám: the list, the visit detail (results, medications, to-dos as part of the visit, vaccinations), and document files through signed URLs.
- R5: `/cases/[id]` opens read-only; edit and delete are hidden.
- R6: Member-only UI is hidden (not rendered) for anonymous visitors: other tabs, person nav, "+", search, chat, edit/delete/add buttons, uploader, "Xem tất cả" links into locked tabs.
- R7: Anonymous visitors can only arrive by direct link; there is no public index of people.
- R8: Data for anonymous reads comes from read-only `SECURITY DEFINER` RPCs that return exactly what the public pages show. Tables keep members-only RLS; no `to anon` table or storage policies; no service key.
- R9: Search engines may index the public pages (user confirmed after being told about names, diagnoses and scans showing up in Google and staying in caches).
- R10: The header shows an "Đăng nhập" link for anonymous visitors; after login it returns to the same page.

## Grill log

Max rounds: 5.

| Round | Area | Question | Answer | Decision |
| :-- | :-- | :-- | :-- | :-- |
| 1 | permissions | Who counts as anonymous? | Anyone with the URL | R1 |
| 1 | scope | Which overview is public? | Person Tổng quan tab | R2 |
| 1 | scope | How deep for Lần khám? | List + detail + files | R4 |
| 1 | scope | Locked UI shown how? | Hidden | R6 |
| 2 | scope | Which Tổng quan sections? | Attention + latest results, Bệnh án, AI summary | R3 (to-dos hidden) |
| 2 | scope | Entry point for anonymous? | Direct link only | R7 |
| 2 | data | How does the DB serve anon reads? | Read-only RPCs | R8 |
| 2 | permissions | Search indexing? | Allow indexing | R9 (pending confirm) |
| 3 | scope | Does /cases/[id] open? | Read-only case page | R5 |
| 3 | permissions | Confirm indexing given the privacy risk? | Yes, allow indexing | R9 |
| 3 | scope | Sign-in link for anonymous? | "Đăng nhập" in header | R10 |

## Open questions

- None.
