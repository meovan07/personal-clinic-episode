# Roadmap

## Status

| Phase | What | Status |
|---|---|---|
| 1 – Storage | People, bệnh án, visits, multi-page document upload (with duplicate detection), medications, to-dos | ✅ |
| 2 – AI extraction | Read uploaded PDFs/photos, review screen, test catalog, unit normalization | ✅ |
| 3 – Insights | Per-test charts, AI "what changed" health summary | ✅ |
| 4 – Quick add | One "+" upload; AI matches the document to a person, bệnh án and visit | ✅ |
| 5 – Sổ tiêm chủng | Vaccination history per person, read from vaccination cards like lab results | ✅ |
| 6 – Redesign & AI upkeep | Visual redesign; Markdown health summary; to-dos refined with context; "Thêm lần khám" leads with the photo | ✅ |
| 7 – Extras | Search ✅ · printable doctor summary ✅ · calendar ✅ · installable app (PWA) ✅ · reminders by Web Push ✅ | ✅ |
| 8 – Chat assistant | 8a ask ✅ · 8b change with approval ✅ · 8c documents in the chat ✅ · 8d "+" menu and polish ✅ | ✅ |
| 9 – Revamp for non-medical readers | Foundation ✅ · home ✅ · person page with plain-language results ✅ · visit page ✅ · bệnh án, vaccinations, desktop ✅ · review screens ⏳. See [design.md](design.md#revamp-plan) | nearly done |

## Next

0. **Phase 9 revamp** (current): stages 1–5 done except the upload review screens (`ReviewForm`, `InboxReviewForm`), which still have the old layout in the new colors. Earlier plan for stage 5, for reference: (bệnh án page with key values over time, vaccination add form in a sheet, the upload review screens, two-column desktop). Plan and review in [design.md](design.md).
1. **Reminders by Web Push**: live (migration applied 02/10/2026, job verified on production). Turn on "Nhắc lịch" on each phone from the installed app.
2. **Known issue:** on iPhone the chat panel sometimes still leaves a gap above the keyboard; left as is for now.
3. **Smaller items**
   - Turn on Supabase's leaked-password protection (Auth settings; flagged by the security advisor).
   - Benchmark the models for the health summary and to-do polishing (`src/lib/ai/summarize.ts`, `polish.ts`, still `gpt-5.5`), as was done for extraction and chat.
   - Clean up test data left from development: a memory "Pate thích câu trả lời ngắn gọn…" and a few test conversations in the assistant's history.

## To-do (from use)

Also listed in the README:
1. Clean file names and compress photos before upload (`src/lib/upload.ts`).
2. Let each member set their own display name on the Cài đặt page (needs an RLS policy to update one's own `members` row).
3. One name per hospital: store facilities once, match new documents to them, and merge existing variants ("Bệnh viện Đa khoa Gia Đình" / "BỆNH VIỆN ĐA KHOA GIA ĐÌNH" / "BV Gia Đình"). `tidyName` only fixes capitals on screen.

## Open questions

- Keep chat history forever, or expire it after a while?
- Voice input in the chat (Vietnamese speech to text)?
- Should creating a record through the assistant also need approval, or only updates and deletes? (Today every change is approved.)

## Change log

| Date | Change |
|---|---|
| 02/10/2026 | Assistant: `update_vaccination` to move a due dose or stop its reminder ("bỏ qua mũi đó, sang năm tiêm"); chat bubbles use the same text size on both sides. |
| 02/10/2026 | **Phase 9, stage 5:** bệnh án page with the results worth following for that illness (trend or out of range) and its to-dos; vaccination add form in a sheet; two-column home on wide screens. Result aggregation shared in `src/lib/results.ts` (tested). |
| 02/10/2026 | **Phase 9, stage 4:** visit page with results out-of-range first and explained (normal ones folded), add-medication form in a sheet, deletes behind "⋯", tidy hospital name, documents at the bottom. |
| 02/10/2026 | **Phase 9, stages 1–3:** Cài đặt page (logout, reminders, install), "⋯" menus and bottom sheets, due chips ("Quá hạn 8 tháng"), tidy hospital names. Home: "Cần chú ý" first, a card per person, 7-day strip with the month on demand, to-dos split from the doctor's advice, 3 latest visits plus an all-visits page. Person page with tabs; results grouped by body part with plain explanations for all 48 catalog tests (`src/lib/test-info.ts`). |
| 02/10/2026 | **Phase 9, stage 1 (part):** new design foundation (Color Hunt soft-blue palette, curated.design-style borderless cards and pill buttons, Newsreader serif titles, light and dark mode from the device setting, tabular figures instead of the typewriter font); swipeable photo viewer on the visit page (all pages of all documents, double-tap or button to zoom, stays in the app). UX review and revamp plan in [design.md](design.md). |
| 02/10/2026 | Web Push reminders: "Nhắc lịch" switch per device on the home page (with a test notification), and a daily 08:00 job that sends to-dos and vaccine doses due today or tomorrow as one notification. |
| 02/10/2026 | Installable app (PWA): manifest, home-screen icons, service worker with an offline page, iPhone install hint. iOS keyboard fixes: bottom bar and "+" hide while typing, chat and search follow the visible area, number pad for day counts, empty date fields keep their height, chat box grows with the text. |
| 02/10/2026 | Daily keep-alive: Vercel Cron calls `/api/keep-alive` so the free Supabase project isn't paused after a week without use. |
| 02/10/2026 | **8d:** "+" opens a menu (Hỏi trợ lý AI / Tải ảnh, PDF); the separate assistant button is gone; Esc closes the chat; short entrance animations (off with reduced motion). |
| 02/10/2026 | **8c:** photos/PDFs can be sent in the chat; the assistant reads them and files them after approval. Inbox logic moved to `src/lib/services/inbox.ts`. Inline confirm replaces `window.confirm()` in the chat lists. |
| 02/10/2026 | **8b:** the assistant can create, change and delete records behind approval cards; changes are logged in `agent_actions`. Record logic moved to `src/lib/services/records.ts`. |
| 02/10/2026 | Document extraction switched from `gpt-5.5` to `gpt-6-luna` after a benchmark on reviewed documents (same accuracy, ~1/50 of the cost). See [ai.md](ai.md#models). |
| 02/10/2026 | Assistant memory: saved conversations, compaction of long threads, silent long-term memory. |
| 01/10/2026 | **8a:** read-only chat assistant with 8 lookup tools. Chat model `gpt-6-luna` chosen by benchmark. |
| 01/10/2026 | Phase 7: search popup, printable doctor summary, 3-month calendar. |
| 28–30/09/2026 | Phases 1–6. |
