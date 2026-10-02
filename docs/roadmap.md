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
| 7 – Extras | Search ✅ · printable doctor summary ✅ · calendar ✅ · installable app (PWA) ✅ · reminders by Web Push (built; waiting for its migration) | 4 of 5 |
| 8 – Chat assistant | 8a ask ✅ · 8b change with approval ✅ · 8c documents in the chat ✅ · 8d "+" menu and polish ✅ | ✅ |

## Next

1. **Reminders by Web Push**: built (see change log). To go live: apply `supabase/migrations/20261002071117_push_reminders.sql` and insert the cron token hash (see [development.md](development.md#push-reminders)), then turn on "Nhắc lịch" on each phone.
2. **Known issue:** on iPhone the chat panel sometimes still leaves a gap above the keyboard; left as is for now.
3. **Smaller items**
   - Turn on Supabase's leaked-password protection (Auth settings; flagged by the security advisor).
   - Benchmark the models for the health summary and to-do polishing (`src/lib/ai/summarize.ts`, `polish.ts`, still `gpt-5.5`), as was done for extraction and chat.
   - Clean up test data left from development: a memory "Pate thích câu trả lời ngắn gọn…" and a few test conversations in the assistant's history.

## Open questions

- Keep chat history forever, or expire it after a while?
- Voice input in the chat (Vietnamese speech to text)?
- Should creating a record through the assistant also need approval, or only updates and deletes? (Today every change is approved.)

## Change log

| Date | Change |
|---|---|
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
