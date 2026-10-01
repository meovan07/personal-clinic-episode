# Sổ bệnh án

A private website for storing the medical records of two people: cases (bệnh án), visits, documents (photos and PDFs), medications and to-dos. The interface is in Vietnamese.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · OpenAI (document reading) · Tailwind CSS 4

## Roadmap

- [x] **Phase 1 – Storage:** people, cases, visits, multi-page document upload (with duplicate detection), medications, to-dos
- [x] **Phase 2 – AI extraction:** read uploaded PDFs/photos, extract results, review screen, test catalog
- [x] **Phase 3 – Insights:** per-test charts, "what changed" summaries
- [x] **Phase 4 – Quick add:** a single "+" upload; AI matches the document to a person and bệnh án instead of manual selection
- [x] **Phase 5 – Sổ tiêm chủng:** vaccination history per person (vaccine, dose, date given, next due date), read from scanned vaccination certificates the same way lab results are today
- [x] **Phase 6 – Redesign & AI-assisted upkeep:** full visual redesign (see [Design](#design)); the AI health summary renders as Markdown with restrained highlighting instead of a wall of text; to-dos can be edited with added context, which the AI resolves against the real family roster and recent visit history (not just rephrased); vaccination doses carry the AI's general knowledge of whether that vaccine is typically single-dose; "Thêm lần khám" leads with the photo upload, and AI fills in the visit's date/facility/khoa/bác sĩ instead of retyping what the photo already says
- [ ] **Phase 7 – Extras:**
  - [x] search: header popup (`/` or Ctrl+K) over everything, ignoring diacritics, with everyday Vietnamese terms per test ("mỡ máu", "men gan") and typo tolerance (`search_records` in Postgres)
  - [x] a summary for doctors: printable page per person (`/people/[id]/summary`) with allergies, active illnesses, recent medications, latest results vs. an earlier date, vaccinations and recent visits
  - [x] calendar: month view on the home and person pages (3 months on wide screens, 1 on phones) of visits and vaccinations done, upcoming to-dos and next doses, and overdue items
  - [ ] reminders that reach you (email / push notifications)
- [ ] **Phase 8 – Chat agent:** replace the manual forms (add person/visit/case, upload, to-dos) with a conversational agent — tell it what happened at the doctor and it does the data entry. Technical design: [Phase 8 design](#phase-8-design-chat-agent)

## Data model

`people` → `cases` → `visits` → `documents` (→ `document_files`, one row per page) / `observations` / `medications`, plus `vaccinations` (per person, from confirmed certificates or added by hand; `typically_single_dose` holds the AI's general knowledge of that vaccine's usual schedule), `action_items` (`notes` holds context added on edit, folded into `content` by AI) and `ai_summaries`. Every table has row-level security, and only accounts listed in `members` can read or write. Original files live in the private `documents` storage bucket and are only served through signed URLs that expire after 1 hour. See `supabase/migrations/`.

## How AI extraction works

1. Upload the pages of one document (PDF or photos) — from a visit's own page, from the global "+" (which also guesses who it belongs to), or by leading with the photo on "Thêm lần khám" (see below). Then press **Đọc bằng AI** (read with AI).
2. The server sends the files to OpenAI (`src/lib/ai/extract.ts`) with a strict JSON schema. The model copies names, values, units and ranges exactly as printed. It never converts anything. Requests use `store: false`.
3. The **review screen** (`/documents/[id]/review`) shows the original next to editable fields. Nothing is saved until you press **Xác nhận** (confirm).
4. On confirm, `src/lib/normalize.ts` does the maths in code, not in the LLM:
   - matches test names to `test_catalog` (aliases, with or without diacritics)
   - converts units using `unit_conversions`, e.g. mg/dL → mmol/L (the printed value is kept in `raw_value` / `raw_unit`)
   - reads reference ranges (`3,9 - 6,4`, `< 5.18`, `(≤ 40)`) and recomputes high/low
   - turns the doctor's advice and the follow-up date into to-dos
   - saves vaccination doses (skipping doses already recorded from an earlier photo of the same card), flags whether that vaccine is typically single-dose, and turns a future next-dose date into a to-do
   - fills in any visit fields (date, facility, khoa, bác sĩ) left blank

   Confirming again replaces the rows created from that document.

**"Thêm lần khám"** (`src/components/NewVisitForm.tsx`) leads with the upload instead of ending with it: attaching a photo creates the visit, uploads, and reads it immediately, filling in the fields below with what it found before you ever have to type them. Saving with no photo still works exactly like a plain form.

To add a test to the catalog, insert a row into `test_catalog` (and `unit_conversions` if labs print it in another unit). Run `npm test` for the normalization tests.

## Where else AI is used

- **Tóm tắt sức khỏe** (person page) renders as Markdown (`src/components/HealthSummary.tsx`) — the prompt (`src/lib/ai/summarize.ts`) is told to highlight sparingly: only genuinely important facts (an abnormal value, a drug name, an upcoming date), never whole sentences.
- **Editing a to-do** with added context doesn't just rephrase what you typed: `updateActionItem` hands the AI the real family roster and the person's recent visits/bệnh án so it can resolve a vague reference ("chồng" → an actual name) or match a vague test against what was really recorded, capped to a short title (`src/lib/ai/polish.ts`).

## Phase 8 design: chat agent

Status: **design only, not implemented.** The UX (how the "+" button offers "Tải tài liệu" vs. "Hỏi AI") will be decided later; this section settles what is technically possible and how it will be built.

### Goal

A chat opened from the existing bottom-right "+" button that can do anything the app can: answer questions over the records ("LDL của Hưng thay đổi thế nào?"), create and update records ("hôm nay Mai khám ở BV Gia Đình, bác sĩ dặn tái khám sau 2 tuần"), and read photos/PDFs sent in the chat. Every write needs the user's approval in the chat (human in the loop, HITL), and destructive actions are clearly marked as such.

### Options considered (checked against the packages' current versions, Oct 2026)

| Option | What it is | HITL | Fit here |
|---|---|---|---|
| **Vercel AI SDK v7** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) | Library: `streamText` on a Next.js route + `useChat` hook | Built in: `toolApproval: { tool: "user-approval" }` on `streamText`; the client answers with `addToolApprovalResponse`; approvals can be HMAC-signed (`experimental_toolApprovalSecret`) so a client can't forge one | **Chosen.** Runs inside this Next.js app on Vercel, no extra server, we own the UI, provider-agnostic (OpenAI today, Claude or others later by swapping one import) |
| Mastra (`@mastra/core` 1.x) | Agent framework on top of AI SDK: agents, workflows, memory, evals | `requireApproval` on tools, suspend/resume workflows | More than two users need. Revisit if we want long-term memory or multi-step workflows |
| CopilotKit (1.x) | In-app copilot UI + runtime endpoint (AG-UI protocol) | `renderAndWaitForResponse` actions | Opinionated UI and an extra runtime; strongest when the copilot drives the UI itself rather than the database |
| OpenAI Agents SDK (`@openai/agents` 0.x) | OpenAI's agent loop | `needsApproval` + interruptions | Works, but ties us to OpenAI and still needs our own chat UI and streaming glue |
| "Built-in ChatGPT" (ChatGPT Apps / MCP server) | Expose our tools to the ChatGPT app | ChatGPT's own confirmations | The chat would live in ChatGPT, not behind our "+" button. Possible later as an extra entry point, reusing the same tools |

### Architecture

```
"+" button → mode menu (later) → <ChatPanel> (useChat, @ai-sdk/react)
   │  POST /api/chat  (route handler, streaming, maxDuration 300)
   ▼
streamText({ model: openai(OPENAI_MODEL), tools, toolApproval, stopWhen: isStepCount(10) })
   │  tool calls
   ▼
src/lib/services/*  ← the same functions the server actions use
   │  Supabase client created from the user's cookies
   ▼
Postgres with row-level security (members only)
```

- **Same permissions as the user.** Tools use the signed-in user's Supabase session, so row-level security applies exactly as in the UI: the agent can never see or change more than the person chatting.
- **Shared services (prerequisite refactor).** The logic in `src/app/actions.ts` (create/update/delete for people, cases, visits, documents, medications, to-dos, vaccinations, extraction) moves into plain functions in `src/lib/services/*` that take a Supabase client and return data. Server actions keep `redirect`/`revalidatePath`; agent tools call the same functions. One implementation, two front doors.
- **Streaming UI** with `toUIMessageStreamResponse()` on the server and `useChat` on the client. Tool calls render as cards (e.g. a results table, a visit summary) instead of raw JSON.

### Tools and approval policy

| Tier | Tools | Approval |
|---|---|---|
| Read | `search_records` (the existing Postgres search), `get_person_overview`, `list_visits`, `get_visit`, `get_test_history` (one test over time), `list_todos`, `list_vaccinations`, `get_calendar` | Runs automatically |
| Write | `create_visit`, `update_visit`, `create_case`, `update_case` (e.g. mark đã khỏi), `add_medication`, `add_todo`, `update_todo`, `complete_todo`, `add_vaccination`, `ingest_document` (photo/PDF from the chat → existing extraction pipeline → confirm) | **Approval card** showing exactly what will be written (before → after for updates) |
| Destructive | `delete_visit`, `delete_case`, `delete_document`, `delete_medication`, `delete_todo`, `delete_vaccination` | **Red approval card** listing everything the delete removes (e.g. a visit's documents and results) |
| Not exposed | deleting a person, managing members/accounts | Only in the normal UI |

How approval works: `streamText` is called with a `toolApproval` map (`"approved"` for reads, `"user-approval"` for writes and deletes). When the model calls a gated tool, the stream ends with a `tool-approval-request` part; the chat shows the card; the user's choice is sent back with `addToolApprovalResponse` and the request continues: approved → the tool runs, denied → the model is told and can propose something else. Approval requests are HMAC-signed with a server secret (`CHAT_APPROVAL_SECRET`), and every tool re-validates its input with zod on the server.

### Safety

- **No raw SQL tool.** Queries go through typed read tools and `search_records`, so the model cannot write arbitrary SQL.
- **IDs come from tool results only.** The system prompt and input schemas require IDs returned by an earlier tool call; a made-up ID fails RLS or validation instead of touching the wrong row.
- **Prompt injection.** Text read from documents is treated as data. Even if a scanned page contained instructions, any write it led to would still stop at an approval card.
- **Medical scope.** The agent reports and organizes what is in the records; it doesn't diagnose, matching the AI extraction rules.
- **Audit log.** Each executed write/delete is recorded in an `agent_actions` table (who, when, tool, input, result) for undo and debugging.
- **Privacy.** Requests use `store: false` on OpenAI's side, like extraction.

### Data

New tables, members-only RLS like every other table:
- `chat_threads (id, created_by, title, created_at)`
- `chat_messages (id, thread_id, role, parts jsonb, created_at)` — stores AI SDK UI messages so a conversation can be resumed
- `agent_actions (id, thread_id, user_id, tool, input jsonb, result jsonb, created_at)`

### Context given to the model

Today's date in Vietnam time, the two people (ids, names), their open bệnh án and recent visits as a short summary. Anything more is fetched through read tools, so the prompt stays small.

### Configuration

`OPENAI_MODEL` (shared with extraction, default `gpt-5.5`) and `CHAT_APPROVAL_SECRET`. A step limit (`stopWhen: isStepCount(10)`) and a per-message token cap keep a single request from running away.

### Rollout

1. **8a – Ask:** read tools only. Questions over the records with sourced answers (links to visits/results).
2. **8b – Do:** write and destructive tools behind approval cards; `agent_actions` log.
3. **8c – Show:** send a photo/PDF in the chat → extraction → approval card with the extracted values.
4. **8d – UX:** the "+" mode menu, conversation history, and polish.

### Open questions

- Should creates also need approval, or only updates and deletes? (Default above: every write is approved.)
- Keep chat history forever, or expire it after a while?
- Voice input in the chat (Vietnamese speech to text)?

## Design

The look is a private family record book, not a generic SaaS dashboard: warm kraft-paper background, flat hairline-bordered panels (no drop shadows), a deep clinic-green for actions, ballpoint-ink blue for links, red stamp ink for destructive/overdue, and a shared functional palette for lab/vaccination flags (normal/low/high). All of it is named CSS custom properties in `src/app/globals.css`, with the reasoning in comments there. Icons are [lucide-react](https://lucide.dev/); there's no emoji anywhere in the UI. Mobile is the primary surface — a bottom tab bar (`PersonNav.tsx`) switches between the two people, and `viewport-fit=cover` + `env(safe-area-inset-*)` keep the header/bottom nav clear of notches and home indicators.

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
