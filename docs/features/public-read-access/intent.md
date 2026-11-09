# Intent: Public read access to Tổng quan and Lần khám

Author: Hung. Status: approved. Approved: 2026-11-09.

## Goal

A signed-out visitor who opens a direct link can read a person's Tổng quan and Lần khám, plus the visit and case pages behind them, while every other page and every write still requires a member login.

Done when: in a private browser window (no session), `/people/<id>?tab=tong-quan`, `/people/<id>?tab=lan-kham`, `/visits/<id>` (with document images) and `/cases/<id>` load with HTTP 200 and no edit controls; `/`, `/people/<id>?tab=chi-so`, `/settings` and `/visits/new` redirect to `/login`; and a direct Supabase REST query with the publishable key for `visits` returns 0 rows.

## Problem

Today every page needs a member login (`src/proxy.ts`, members-only RLS). The household can't send a visit or overview to someone outside the app, such as a doctor or relative, without giving them an account.

## Proposed outcome

Anyone with a link can view a person's overview and visit history read-only, including document scans. Members see the app exactly as before.

## Affected users and systems

- Anonymous visitors (read-only); members (no change in behavior).
- `src/proxy.ts`, the pages `people/[id]`, `visits/[id]`, `cases/[id]`, `AppShell` and its header, Supabase (new read-only RPCs; tables keep members-only RLS), and the private `documents` storage bucket (signed URLs for public visits).

## Constraints

- Real medical data. The user chose public and indexable on purpose (analysis R1, R9).
- No `to anon` table or storage policies and no service key in pages (analysis R8; architecture.md "Every database call runs as the signed-in user").
- No writes for anonymous visitors: server actions, `/api/chat`, uploads and the inbox stay members-only.
- Member-only UI is hidden, not disabled (R6).
- Next.js 16: read `node_modules/next/dist/docs/` before touching proxy/routing.

## Open questions

- Signed URLs for document files need either a storage policy or a server-side signer. The spec must pick one that doesn't open the bucket to anon listing.
- Does the AI summary on Tổng quan, or any visit field, include data from locked areas (for example Chỉ số trends)? The spec should state that what's shown is the same content members see.
