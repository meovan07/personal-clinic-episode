# Architecture

## Overview

```
Browser (Next.js pages, server actions, the chat panel)
   │
   ├─ server actions (src/app/actions.ts) ──┐
   ├─ POST /api/chat (the assistant) ───────┤──► src/lib/services/*  (one implementation of every change)
   │                                         │
   ▼                                         ▼
Supabase client with the user's session ──► Postgres with row-level security (members only)
                                            Storage bucket "documents" (private)
OpenAI (server-side only, store: false) ◄── document reading, summaries, chat
```

Every database call runs as the signed-in user, never with a service key, so row-level security decides what anyone (including the assistant) can see or change.

## Code map

| Path | What |
|---|---|
| `src/proxy.ts` | Next.js 16 proxy (formerly middleware): refreshes the Supabase session, sends signed-out visitors to `/login` |
| `src/app/` | Pages (App Router). `actions.ts` holds the server actions behind every form; they validate, call a service, then `revalidatePath`/`redirect` |
| `src/app/api/chat/route.ts` | The assistant's streaming endpoint (see [assistant.md](assistant.md)) |
| `src/app/api/keep-alive/route.ts` | Daily ping from Vercel Cron (`vercel.json`) so the free Supabase project isn't paused; the only route that works signed out besides `/login` |
| `src/lib/services/records.ts` | Create/update/delete for bệnh án, visits, documents, medications, to-dos, vaccinations. Shared by the forms and the assistant |
| `src/lib/services/inbox.ts` | Documents without a known visit ("+" and chat uploads): read with AI, save into the records (`applyExtraction`), discard |
| `src/lib/ai/` | OpenAI calls: `extract.ts` (document reading), `summarize.ts` (health summary), `polish.ts` (to-do wording) |
| `src/lib/agent/` | The assistant: tools, approval cards, memory, prompt |
| `src/lib/normalize.ts` | Test-name matching, unit conversion, reference-range parsing, high/low flags (pure code, tested) |
| `src/lib/vaccinations.ts` | Dose series and "next dose due" logic (tested) |
| `src/lib/calendar.ts`, `calendar-data.ts` | Calendar events and month grids (pure functions tested; data loading separate) |
| `src/lib/search.ts` | Types and links for search results |
| `src/lib/upload.ts` | Browser upload pipeline: SHA-256 hash, duplicate check, upload, rollback on failure |
| `src/lib/supabase/` | Supabase clients for the server (cookies) and the browser |
| `src/lib/database.types.ts` | Generated database types (new tables are added by hand when needed) |
| `src/components/` | UI components. Notable: `QuickAddButton` ("+" menu), `AssistantChat` + `ApprovalCard`, `SearchDialog`, `HealthCalendar`, `ReviewForm`/`InboxReviewForm` |
| `supabase/migrations/` | The schema, in order. Applied to production as described in [development.md](development.md#database-changes) |

## Data model

`people` → `cases` (bệnh án) → `visits` (lần khám) → `documents` (→ `document_files`, one row per page) / `observations` (lab values) / `medications`.

Also:
- `vaccinations` — per person, from confirmed vaccination cards or added by hand. `typically_single_dose` holds the AI's general knowledge of that vaccine's usual schedule.
- `action_items` — to-dos; `notes` holds context added when editing, which the AI folds into `content`.
- `ai_summaries` — generated health summaries, with the snapshot they were built from.
- `inbox_items` / `inbox_files` — uploads waiting for review ("+" button and chat attachments), with the AI's reading and its person/bệnh án/visit guesses.
- `test_catalog` (codes, Vietnamese names, aliases, everyday search terms, standard unit) and `unit_conversions`.
- Assistant: `chat_threads`, `chat_messages`, `agent_memories`, `agent_actions` (see [assistant.md](assistant.md#data)).
- `members` — the accounts allowed in (`user_id`, `display_name`).

Rows created from a document carry its `document_id`, so re-confirming a document replaces exactly those rows, and deleting a document removes its medications, to-dos and vaccinations (lab results stay on the visit).

## Security

- **Members only.** Every table has row-level security. Policies call `private.is_member()`, a `SECURITY DEFINER` function in a schema that isn't exposed through the API, which checks the `members` table. Public sign-up is turned off.
- **Private files.** Originals live in the private `documents` storage bucket and are shown through signed URLs that expire after 1 hour.
- **Secrets stay on the server.** Only the Supabase URL and publishable key are public; `OPENAI_API_KEY` is server-only. OpenAI requests use `store: false`.
- **Assistant.** Runs as the user (same RLS), has no raw-SQL tool, and every change goes through an approval card and is logged. Details in [assistant.md](assistant.md#safety).

## Search

`public.search_records(q)` (Postgres, `SECURITY INVOKER`, so RLS applies) searches visits, results, documents, medications, bệnh án, to-dos, vaccinations and people:
- diacritics are ignored (`unaccent`, đ → d) and matching is by word start, so "mo mau" finds "Mỡ máu" but not "hemoglobin";
- results are enriched with Vietnamese keywords (flags → "cao/thấp bất thường", document types, "tiêm chủng vắc xin"), and `test_catalog.search_terms` maps everyday words to tests ("mỡ máu" → LDL, cholesterol…);
- when nothing matches exactly, a `pg_trgm` fallback returns close matches flagged `approximate`, and the popup says so.

The popup (`SearchDialog.tsx`) opens from the header, `/` or Ctrl/⌘+K.

## Calendar and doctor summary

- **Calendar** (`HealthCalendar.tsx`, home and person pages): month grids, 3 months on wide screens and 1 on phones, with past visits and doses, upcoming to-dos and next doses, and overdue items. Dates are computed in Vietnam time. A vaccine to-do is hidden when the same due dose is already shown.
- **Doctor summary** (`/people/[id]/summary`): one printable A4 page with allergies, history, active and resolved bệnh án, medications from the last 180 days, the latest result of each test next to the previous one from an earlier date, vaccinations and recent visits. "In / Lưu PDF" uses the browser's print dialog.

## Installable app (PWA)

- `src/app/manifest.ts` (served as `/manifest.webmanifest`) and the icons in `src/app/app-icons/[file]/route.tsx` (192, 512 and a maskable 512, drawn like the favicon) make the site installable; it opens full-screen with the header color in the status bar.
- `public/sw.js`, registered by `AppShell.tsx`, caches only `public/offline.html`, shown when a page can't load without a connection. Records are never cached, so nothing private stays in the browser. It also handles push notifications and taps on them (for reminders).
- iPhone Safari never offers to install by itself, so the home page shows a one-time hint (`InstallHint.tsx`) on iOS outside the installed app.
- The proxy lets the manifest, icons, service worker and offline page load signed out; otherwise the app can't be installed from the login page.

### On-screen keyboard (iOS)

iOS Safari doesn't shrink the page when the keyboard opens, so fixed elements misbehave. `AppShell.tsx` handles it app-wide:
- `--vv-top` / `--vv-height` follow the visible area (`visualViewport`, re-measured at 100/300/600 ms because iOS can report it mid-animation). On phones the chat panel and search popup cover the whole screen with their background, while their content column follows the visible area, so the header and input stay on screen and the page never shows through next to the keyboard.
- `html[data-keyboard]` is set while a text field has focus on a touch screen; the bottom tab bar and the "+" button (`.hide-with-keyboard`) hide instead of floating over the field, and `.safe-bottom` drops the home-indicator padding.
- The chat box doesn't grab focus on phones (the keyboard would cover the suggestions), shows "send" on the return key and grows with the text. Day-count fields open the number pad, and empty date fields keep their height.

## Design system

The look is a private family record book, not a SaaS dashboard: warm kraft-paper background, flat hairline-bordered panels, deep clinic green for actions, ballpoint blue for links, red stamp ink for destructive and overdue, and one palette for lab and vaccination flags (normal/low/high). All colors are named CSS custom properties in `src/app/globals.css`, with the reasoning in comments. Icons are [lucide-react](https://lucide.dev/); no emoji in the UI.

Mobile is the primary surface: a bottom tab bar (`PersonNav.tsx`) switches between the two people, and `viewport-fit=cover` with `env(safe-area-inset-*)` keeps bars clear of notches. Destructive actions confirm in the app (a dialog or an inline Huỷ / Xoá), never with the browser's `confirm()`. Entrance animations (`anim-*` in `globals.css`) are short and switched off for reduced motion.
