# Analysis: Audio recording upload with transcript and AI summary

Ticket: user request in chat (09/11/2026). Analyzed: 09/11/2026. Status: grilled.

## Ticket

"I want to build another upload but this one is record one, like m4a, we need transcript and summarize by AI"

## What it asks

Upload audio recordings (m4a and similar) alongside photos/PDFs, get a transcript, and have the AI summarize it, ending up in the records like other documents.

## What's ambiguous

- What the recordings are (doctor consultation, own voice note, phone call).
- Where they attach (visit, inbox with AI matching, chat).
- Recordings over OpenAI's 25 MB per-request limit.
- Whether the audio is kept after transcription (storage on the free Supabase plan).

## Ticket validity

Verdict: valid

Evidence:
- Uploads today are photos/PDFs only: `src/lib/upload.ts` (image shrink, PDFs as-is), `documents.doc_type` check in `supabase/migrations/20260928000000_init.sql:70`.
- Extraction already yields summary, diagnoses, advice, follow-up, medications (`src/lib/ai/extract.ts`), applied by `applyExtraction` (`src/lib/services/inbox.ts`).
- Server routes allow 300 s (`maxDuration` in `src/app/visits/[id]/page.tsx`, `src/app/inbox/[id]/review/page.tsx`).

Ticket comment: not needed.

## Questions

See grill log.

## Assumptions

none

## Priority

medium. Reason: new capability, no data loss risk, workaround is typing notes by hand.

## First step

Grill the open points below.

## Grill log

Max rounds: 5.

| Round | Area | Question | Answer | Decision |
| :-- | :-- | :-- | :-- | :-- |
| 1 | scope | What are the recordings? | Doctor consultations | R1: extraction prompt treats audio as a spoken consultation (diagnosis, advice, meds, follow-up) |
| 1 | scope | Where uploadable? | Same as photos | R2: visit page, "+" (inbox) and chat all accept audio |
| 1 | edge cases | Over 25 MB? | Split in browser | R3: browser decodes and re-encodes into chunks under 25 MB; each transcribed, then joined in order |
| 1 | data | Speaker labels? | Yes, if model supports it | R4: use a diarizing model if it handles Vietnamese; otherwise plain text |
| 2 | data | Keep audio after transcription? | Keep, compressed | R5: browser re-encodes to low-bitrate mono before upload; stored for replay |
| 2 | scope | In-app record button? | Later | R6: out of scope for v1; upload files only |
| 2 | data | Transcript editable? | Read-only | R7: transcript read-only; corrections go in the extracted fields |
| 2 | failures | Chunk fails? | Retry failed chunks | R8: finished chunks saved; "Thử lại" redoes only failed chunks |
| 3 | rules | Summary format? | Longer structured | R9: Markdown sections (Lý do khám, Bác sĩ nói gì, Chẩn đoán, Dặn dò, Thuốc) plus the usual structured fields |
| 3 | scope | Search and assistant use transcripts? | Summary yes, transcript yes | R10: `search_records` matches transcript text; assistant can read transcripts |
| 3 | scope | Mix audio with photos? | Separate documents | R11: each recording is its own document; photos stay separate |
| 3 | acceptance | Real test file? | User provides one | R12: end-to-end check and model choice use the user's real m4a (local, OpenAI `store: false`) |
| 4 | edge cases | Max length? | 2 hours | R13: over 2 h total duration → error before upload |
| 4 | rules | Person/visit matching in "+"? | Guess, you confirm | R14: AI guesses from names spoken + file date; low confidence → blank; user confirms on review |

## Open questions

- Which OpenAI transcription model does Vietnamese diarization well enough (R4)? Answer by testing on the user's file.
- Chunk boundaries may cut mid-sentence: overlap a few seconds, or split on silence? Decide in spec (Claude).
