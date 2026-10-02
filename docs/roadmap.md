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
| 7 – Extras | Search ✅ · printable doctor summary ✅ · calendar ✅ · **reminders that reach you** ⏳ | 3 of 4 |
| 8 – Chat assistant | 8a ask ✅ · 8b change with approval ✅ · 8c documents in the chat ✅ · 8d "+" menu and polish ✅ | ✅ |

## Next

1. **Reminders** (last item of Phase 7): a heads-up the day before a follow-up visit, a due vaccine dose or a to-do deadline. A daily Vercel Cron job (about 07:00 Vietnam time) finds what's due and sends it. The channel is still to choose:
   - **Web Push** (free, app-like notifications; on iPhone the site must be added to the Home Screen),
   - **Email** (e.g. Resend's free tier; one morning digest),
   - **Telegram bot** (free, reliable; both members add the bot).
2. **Smaller items**
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
| 02/10/2026 | **8d:** "+" opens a menu (Hỏi trợ lý AI / Tải ảnh, PDF); the separate assistant button is gone; Esc closes the chat; short entrance animations (off with reduced motion). |
| 02/10/2026 | **8c:** photos/PDFs can be sent in the chat; the assistant reads them and files them after approval. Inbox logic moved to `src/lib/services/inbox.ts`. Inline confirm replaces `window.confirm()` in the chat lists. |
| 02/10/2026 | **8b:** the assistant can create, change and delete records behind approval cards; changes are logged in `agent_actions`. Record logic moved to `src/lib/services/records.ts`. |
| 02/10/2026 | Document extraction switched from `gpt-5.5` to `gpt-6-luna` after a benchmark on reviewed documents (same accuracy, ~1/50 of the cost). See [ai.md](ai.md#models). |
| 02/10/2026 | Assistant memory: saved conversations, compaction of long threads, silent long-term memory. |
| 01/10/2026 | **8a:** read-only chat assistant with 8 lookup tools. Chat model `gpt-6-luna` chosen by benchmark. |
| 01/10/2026 | Phase 7: search popup, printable doctor summary, 3-month calendar. |
| 28–30/09/2026 | Phases 1–6. |
