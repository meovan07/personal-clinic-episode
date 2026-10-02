# Chat assistant

Opened from **"+" → Hỏi trợ lý AI**. It answers questions over the records ("LDL của Hưng thay đổi thế nào?"), makes changes ("hôm nay Mai khám ở BV Gia Đình, bác sĩ dặn tái khám sau 2 tuần"), and reads photos/PDFs sent in the chat. Every change waits for the user to approve a card; deletes are shown in red.

## How a message flows

```
AssistantChat (useChat, @ai-sdk/react)
   │  POST /api/chat  { thread id, newest message only }
   ▼
route.ts: signed in? member? → load the thread from chat_messages → compact if long
   │       → system prompt (rules + who's who + long-term memory + thread summary)
   ▼
streamText({ model: CHAT_MODEL, tools, toolApproval, stopWhen: 10 steps, store: false })
   │  read tools run at once; change tools stop at an approval card
   ▼
tools → src/lib/services/* → Postgres (RLS, as the user)
   │
   ▼
stream back to the panel; save new messages; update long-term memory in the background (after())
```

Code: `src/app/api/chat/route.ts`, `src/lib/agent/` (`tools.ts`, `write-tools.ts`, `instructions.ts`, `memory.ts`, `continuation.ts`, `approval.ts`, `attachments.ts`), `src/components/AssistantChat.tsx`, `ApprovalCard.tsx`.

Built with the Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`, pinned to exact versions). It runs inside this Next.js app on Vercel with no extra server, and the provider can be swapped by changing one import. Mastra, CopilotKit, the OpenAI Agents SDK and a ChatGPT app were considered; they added a runtime, tied us to one provider, or moved the chat out of the app.

## Tools

| Kind | Tools | Runs |
|---|---|---|
| Read | `search_records`, `get_person_overview`, `list_visits`, `get_visit`, `get_test_history`, `list_todos`, `list_vaccinations`, `get_calendar`, `read_document` | Immediately |
| Change | `create_case`, `update_case`, `create_visit`, `update_visit`, `add_medication`, `add_todo`, `update_todo` (also ticks a to-do off), `add_vaccination`, `update_vaccination` (move or skip a due dose), `save_document` | After approval (green card) |
| Delete | `delete_case`, `delete_visit`, `delete_document`, `delete_medication`, `delete_todo`, `delete_vaccination`, `discard_document` | After approval (red card) |
| Not available | Deleting a person, managing accounts, editing lab values | Only in the normal UI (lab values on the review page) |

Read tools return `url`s so answers link to the pages they cite. Updates take only the fields that change (`null` clears a field).

## Approval cards

- **Built by the server, before the user sees anything** (`write-tools.ts`): from the tool input and the rows as they are now. Updates show before → after for fields that actually change; deletes list everything that goes with them ("2 tài liệu (4 trang), 58 chỉ số xét nghiệm…") and what stays.
- **Refused automatically** when the change can't be made: the record is gone, a visit or bệnh án belongs to the other person, or nothing would change. The model gets the reason and explains it; the user isn't asked.
- **The user taps Đồng ý / Xoá or Không**, and the conversation continues by itself (`sendAutomaticallyWhen`). A "Không" is passed to the model as the user's choice, and the prompt tells it not to retry.
- **Can't be forged.** The server keeps the conversation. When the user answers, the client sends back the assistant message, and the server takes only "approved: yes/no" from it and applies it to its own stored copy (`continuation.ts`, with tests). So the input that runs is exactly the one the server showed on the card. For this reason no HMAC approval secret is used; that's only needed when the client holds the history.
- **Re-checked and logged.** Each tool validates again right before writing, then records the change in `agent_actions` with the row as it was, so anything can be traced and undone by hand. After a saved change the page behind the chat refreshes.

## Documents in the chat

1. The paperclip next to the message box takes photos/PDFs; several picks add up, so a multi-page document can be shot page by page.
2. On send, the browser uploads them into the inbox exactly like "+" (hash, duplicate check, rollback; `src/lib/upload.ts`), and the message carries a `data-document` part with the inbox id and file names (`attachments.ts`). The model sees a one-line note.
3. `read_document` reads them with the same extraction and matching as "+" (30–60 s the first time; later calls reuse the stored result).
4. `save_document` shows a card with what will be saved: document type, the visit (existing or new from the document's date and facility), bệnh án, diagnoses, the number of results with the out-of-range ones spelled out, medications, doses, advice and follow-up date. It warns when the AI isn't sure whose document it is or the name on the paper points to someone else, lists what it couldn't read, and links to the review page for corrections.
5. `discard_document` throws an upload away. A document neither saved nor discarded waits in the inbox on the home page.

## Memory

| Layer | How it works | Storage |
|---|---|---|
| **Conversation** | Each conversation is saved per user and survives a reload; past ones can be reopened or deleted from **Lịch sử**. The client sends only the newest message; the server loads the rest. An answer is saved even if the panel is closed mid-reply. | `chat_threads`, `chat_messages`, private to the member who started them |
| **Compaction** | When a thread has more than 24 messages not yet summarized, all but the last ~10 are folded into a running summary, always cut at a user message so a question and its answer stay together. Old lookup results are trimmed from what the model sees (`pruneMessages`). | `chat_threads.summary`, `summarized_count` |
| **Long-term** | Silent and automatic: after each answer, a background step reads the exchange and adds, updates or deletes memories (plans, symptoms, doctors, how someone likes answers; never what the records already hold, never secrets). The assistant uses them without talking about it. Each memory records who said it, so one member's preferences don't apply to the other. A list to check or delete sits at the bottom of **Lịch sử**. | `agent_memories`, shared by both members |

## Safety

- **Same permissions as the user.** Tools use the signed-in user's Supabase session; RLS applies exactly as in the UI.
- **No raw SQL.** Lookups go through typed tools and `search_records`.
- **IDs come from tool results.** The prompt and the input schemas require IDs from earlier lookups; a made-up ID fails validation or RLS.
- **Prompt injection.** Text in records and documents is treated as data. Any change it might lead to still stops at an approval card.
- **Medical scope.** The assistant explains what the records say and doesn't diagnose or prescribe.
- **Limits.** 10 steps per answer, 4,000 characters per message, 300 s per request, one retry on model errors. Billing or quota errors from OpenAI show a clear message.
- **Privacy.** `store: false`, with encrypted reasoning passed back so multi-step answers work statelessly.

## Data

Members-only RLS like every other table:
- `chat_threads (id, created_by, title, summary, summarized_count, created_at, updated_at)` — private to the creator.
- `chat_messages (id, thread_id, seq, role, parts jsonb, created_at)` — AI SDK UI messages, so a conversation can be resumed; private to the thread's creator.
- `agent_memories (id, person_id, content, created_by, source_thread_id, created_at, updated_at)` — shared by both members.
- `agent_actions (id, thread_id, user_id, tool, input, before, result, created_at)` — append-only: members can read and add entries, nobody can edit or delete them.

## Context given to the model

The rules, today's date in Vietnam time, which member is chatting, the people (ids, names, birth dates, allergies), open bệnh án, long-term memories with who said them, and the running summary of the thread. Everything else is fetched with tools, so the prompt stays small.
