# Plan: Upload a consultation recording and get a transcript and summary

From: `docs/features/audio-recordings/intent.md` and `spec.md` (R1-R15).

Status: approved
Approved: 2026-11-09
Branch: feature/audio-recordings

## Context

Recordings take the same path as photos (hash → duplicate check → upload → AI read → review → confirm). The new work is a browser step that measures, compresses and splits the audio (R2-R4), a per-part transcription loop with retry (R5-R6), and a consultation mode for extraction (R7-R8). The option below decides the browser step; the server, data and UI parts are the same in every option.

## Approach

Options for the browser audio step:

| | A. mediabunny (WebCodecs) | B. ffmpeg.wasm | C. Minimal: Web Audio + WAV, no compression |
| :-- | :-- | :-- | :-- |
| Fit with Goal | Full: streams 2 h without loading it all, mono ≤48 kbps AAC/Opus (R3), cuts parts (R4) | Full: any codec, same outputs | Partial: breaks R3 (keeps original), and decoding 2 h at once needs ~2.7 GB of memory, so the 2 h cap fails on iPhone |
| Complexity | Low-medium: ~150 lines around the library's `Conversion` and sample reader | Medium: worker, wasm loading, file system API | Low for short files; long files need custom streaming |
| Risk | Needs WebCodecs audio (Safari 26+, Chrome); older iPhones get the "not supported" message | Slow and memory-heavy on iPhone (single-thread wasm, ~30 MB download); may crash on 2 h | Out-of-memory crashes on long recordings |
| Performance | Hardware codecs; a 30-min file in a few seconds | Several times real-time slower on phones; 2 h may take minutes | Fast for short files |
| Reversibility | Isolated in `src/lib/audio.ts`; can be swapped | Same | Same |
| Effort (S/M/L) | M | L | S |
| Pros | Small (tree-shaken, ~100 KB), maintained (1.65.2, updated 04/11/2026), MIT, no server change | Works on old browsers and odd formats (amr) | No dependency |
| Cons | New dependency; old iOS excluded | Heavy download for a PWA, slow on the main device (iPhone) | Doesn't meet the approved spec |

Recommendation: A, because it is the only option that meets R2-R4 (2 h, compressed, split) on the iPhone, the main device, without an oversized download.
Why not the others: B is too heavy and slow on iPhone; C fails R3 and the 2 h cap.
Decision: A (mediabunny), chosen by Hung on 2026-11-09.

## Scope

Do not touch: `src/lib/normalize.ts`, `src/lib/names.ts`, `src/lib/vaccinations.ts`, `src/lib/calendar*.ts`, `src/lib/reminders.ts`, `public/sw.js`, `src/proxy.ts`, existing migration files (only a new one is added), auth and `members` logic, the existing photo/PDF prompt text in `extract.ts` (consultation mode is added beside it).
Review budget per MR: 10 files / 400 lines (tests at half weight). This feature is over it, so breakdown splits it into slices (expected 4-5 MRs, in step order).

## Steps

1. **Data** (R8, R12, R14). New migration `supabase/migrations/20261109010000_audio_recordings.sql`:
   - `doc_type` check adds `consultation_recording`;
   - `documents.transcript jsonb`, `inbox_items.transcript jsonb`;
   - `transcript_parts` table with RLS "members only", a check that exactly one owner is set, and a unique `(coalesce(inbox_item_id, document_id), part_no)`;
   - `search_records` re-created from `20261001084140_search_word_start_matching.sql` with the transcript text and the "ghi âm buổi khám" keyword added.
   - Hand-update `src/lib/database.types.ts`.
   - Tests first: SQL check on a Supabase branch that `search_records('omeprazole')` returns a document whose only match is the transcript, and that inserting a part with both owners fails.
   - Risk: replacing `search_records` could drop the current behaviour; the new body is a copy of the latest one plus two additions, diffed in review.
   - Rollback: down SQL in `supabase/rollbacks/20261109010000_audio_recordings.down.sql` (outside migrations/, which the CLI would apply): drop `transcript_parts`, drop both `transcript` columns, restore the old check and the previous `search_records` body. Safe because no existing rows change.
2. **Browser audio** (R1-R4). `src/lib/audio.ts` (new) with mediabunny:
   - `isSupportedAudio(file)`;
   - `readDuration(file)`;
   - `compressForStorage(file)` (mono, 48 kbps AAC in m4a, falling back to Opus/webm when AAC encoding is missing);
   - `planParts(durationSec, quietAt)`, pure: 10-min marks moved to the quietest 0.5 s within ±10 s;
   - `encodePart(file, start, end)`.
   - `npm i mediabunny@1.65.2`.
   - Tests first (`src/lib/audio.test.ts`, pure parts only): `planParts` gives 9:59 → 1 part, 10:01 → 2, 7200 s → 12, 7201 s → error; cut moves to the quiet point inside ±10 s and never outside; format check on m4a/mp3/wav/webm/ogg/aac vs amr.
   - Risk: mediabunny API differences; verify against its installed docs/types before writing.
3. **Upload pipeline** (R1, R3, R14). `src/lib/upload.ts` gets an audio branch:
   - hash the original, check duration, compress, plan and encode the parts, then upload the recording and the parts; `rollbackUpload` covers all of them.
   - `accept=` adds `audio/*` in `DocumentUploader`, `NewVisitForm`, `QuickAddButton`, `AssistantChat`. Audio is separated from photos in a mixed pick.
   - `createDocument` / `createInboxItem` in `src/app/actions.ts` insert `transcript_parts` rows (`doc_type = consultation_recording` for audio).
   - Tests first: a unit test for splitting a mixed file list into audio vs photos.
   - Rollback: revert (no data shape change beyond step 1).
4. **Transcription** (R5, R6, R15).
   - `src/lib/ai/transcribe.ts` (new): download the part, call `audio.transcriptions.create` with `TRANSCRIBE_MODEL`, `language: "vi"`, `diarized_json`, `chunking_strategy: "auto"`, return segments.
   - Server action `transcribePart(partId)` sets the part `done`/`failed`.
   - A browser hook `useTranscription(owner)` runs pending/failed parts at most 3 at a time and shows "Đang chép lời n/N".
   - `src/lib/transcript.ts` (new, pure): `joinParts` (offsets, order), `formatTime`.
   - Tests first (`src/lib/transcript.test.ts`): a segment 5 s into a part starting at 1202 s → 1207 s ("20:07"); parts are joined by `part_no` even when finished out of order; a failed part leaves `joinParts` incomplete.
   - Risk: whether the transcription endpoint accepts `store: false` (it isn't a Responses call); check the SDK types, and note in `ai.md` that audio transcription doesn't keep data for training by default.
5. **Speaker roles and extraction** (R7, R8, R9).
   - `extract.ts`: `assignSpeakers(parts)` (one structured call returning `{part_no, letter → role}`) and a consultation prompt plus `{ transcript, recordedOn }` input for `extractDocument` / `extractAndMatchDocument`.
   - Server action `finishTranscript(owner)`: join, assign roles, save `transcript`, extract, then `needs_review` (inbox) or `raw_ai_json` (document).
   - `readInboxItem` / `readDocumentWithAI` route audio items here instead of the file reader.
   - Tests first: a pure `applySpeakerRoles` (mapping applied per part; an unmapped letter becomes "Người nói n"); `follow_up_date` computed from `recordedOn`.
   - Model quality is checked on the user's m4a (Proof).
6. **Review screens** (R10, R6).
   - New `AudioPlayer` (signed URL, `<audio controls preload="metadata">`) and `Transcript` (folded, speaker and time per turn).
   - Added to `ReviewForm`, `InboxReviewForm` and `src/app/documents/[id]/review/page.tsx`, `src/app/inbox/[id]/review/page.tsx`.
   - `InboxRetry` shows part progress and retries failed parts only.
   - Tests: none at unit level (UI); covered by the browser check.
7. **Visit page and cleanup** (R11, R14).
   - The visit page renders recordings in their own card (player, Markdown summary through the `HealthSummary` renderer, transcript toggle); `PhotoGallery` skips audio.
   - `saveInboxItem`, `confirmExtraction`, `discardInboxItem` and `deleteDocument` delete the part files and rows; `deleteDocument` also deletes the recording.
   - Tests first: a pure helper listing the storage paths to delete for an owner.
8. **Assistant and search** (R12, R13).
   - `src/lib/agent/tools.ts`: `get_visit` includes recordings with their summary; new `read_transcript(document_id)` capped at 30,000 characters with a cut note; one line in `instructions.ts`.
   - Tests first: the cap helper (30,000 → no note, 30,001 → cut and noted).
9. **Docs** (CLAUDE.md rule). `docs/ai.md` (recordings section, transcription model), `docs/architecture.md` (code map, data model), `docs/assistant.md` (new tool), `docs/roadmap.md` change log, README if it lists the upload types.

Every R has a step: R1 2-3, R2 2, R3 2-3, R4 2, R5 4, R6 4/6, R7 5, R8 1/5, R9 5, R10 6, R11 7, R12 1/8, R13 8, R14 1/3/7, R15 4.

## Slices

Feature flag `NEXT_PUBLIC_AUDIO_UPLOADS` (default off) hides audio in the upload buttons until slice 6 turns it on, so slices 1-5 ship without user-visible change. Lines: estimated added + removed, tests at half weight; `package-lock.json` not counted.

| Slice | Tasks | Files | Est. lines | Shippable alone? (flag/how) | Depended on by | MR | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1/6 | T1, T2 | 5 | 330 | yes, schema + pure helpers, nothing calls them | 2-6 | | pending |
| 2/6 | T3, T4 | 8 | 340 | yes, behind flag off | 3-6 | | pending |
| 3/6 | T5, T6 | 5 | 290 | yes, behind flag off | 4-6 | | pending |
| 4/6 | T7, T10 | 5 | 260 | yes, behind flag off | 5, 6 | | pending |
| 5/6 | T8 | 7 | 250 | yes, behind flag off | 6 | | pending |
| 6/6 | T9, T11 | 10 | 260 | yes, turns the flag on | none | | pending |

## Tasks

Every task is test-first: a failing test before the code. Tick the box when the acceptance criteria pass.

- [x] T1 Add the audio recordings migration and types (R8, R12, R14)
  - Acceptance: `doc_type` accepts `consultation_recording`; `documents.transcript` / `inbox_items.transcript` exist; `transcript_parts` exists with RLS members only, an exactly-one-owner check and unique `(owner, part_no)`; `search_records('omeprazole')` returns a document whose only match is its transcript; "ghi âm" matches `consultation_recording` documents; all other search results unchanged.
  - Tests: SQL on a Supabase branch first: insert a part with both owners → fails; with neither → fails; search before/after on the same seed returns the same rows plus the transcript hit.
  - Files: `supabase/migrations/20261109010000_audio_recordings.sql`, `supabase/rollbacks/20261109010000_audio_recordings.down.sql`, `src/lib/database.types.ts`
  - Lines (est.): 220
  - Size: M
  - Depends on: none
  - Rollback: down SQL `supabase/rollbacks/20261109010000_audio_recordings.down.sql` (outside migrations/ so the CLI never applies it) (restores the previous `search_records` body and check); safe since no existing rows change.
- [x] T2 Add pure audio planning helpers (R1, R2, R4)
  - Acceptance: `isSupportedAudio` accepts m4a/mp3/wav/webm/ogg/aac by type or extension, rejects amr; `planParts(durationSec, quietAt)` gives 599 s → 1 part, 601 s → 2, 7200 s → 12, 7201 s → throws the "dài hơn 2 giờ" error; each cut is at `quietAt`'s answer and within ±10 s of the 10-min mark; `splitAudioFiles(files)` separates audio from photos/PDFs.
  - Tests: `src/lib/audio-plan.test.ts` first, with the boundaries above and a `quietAt` stub that returns a point outside the window (clamped).
  - Files: `src/lib/audio-plan.ts`, `src/lib/audio-plan.test.ts`
  - Lines (est.): 70 + 80 tests
  - Size: S
  - Depends on: none
- [ ] T3 Add the browser audio processing with mediabunny (R2, R3, R4)
  - Acceptance: `readDuration`, `compressForStorage` (mono ≤ 48 kbps, AAC/m4a, else Opus/webm), `findQuietPoint(file, around)`, `encodePart(file, start, end)` (≤ 24 MB); a 30-min 128 kbps stereo m4a compresses to ≤ 11 MB with duration within 1 s; no WebCodecs audio → the "Trình duyệt này chưa hỗ trợ" error. Checked on a real iPhone (installed app) before T4 starts.
  - Tests: no unit test (WebCodecs isn't in Node); a dev-only page check in the browser preview with a sample file, and the iPhone check, both reported.
  - Files: `src/lib/audio.ts`, `package.json`, `package-lock.json`
  - Lines (est.): 160
  - Size: M
  - Depends on: T2
- [ ] T4 Accept audio in the upload pipeline behind the flag (R1, R3, R14)
  - Acceptance: with `NEXT_PUBLIC_AUDIO_UPLOADS=1`, the four pickers accept audio; audio is hashed on the original, duration-checked, compressed, split, uploaded with its parts; a failed upload removes every uploaded file; `createDocument` / `createInboxItem` save `consultation_recording` and the `transcript_parts` rows; a mixed pick gives separate items; with the flag off nothing changes.
  - Tests: extend `src/lib/audio-plan.test.ts` with a failing case for the mixed pick → `{audio:[m4a], other:[jpg, pdf]}`; flag-off check in the browser preview.
  - Files: `src/lib/upload.ts`, `src/components/DocumentUploader.tsx`, `src/components/NewVisitForm.tsx`, `src/components/QuickAddButton.tsx`, `src/components/AssistantChat.tsx`, `src/app/actions.ts`
  - Lines (est.): 180
  - Size: M
  - Depends on: T1, T3
  - Rollback: revert; flag off hides it.
- [ ] T5 Add pure transcript helpers (R4, R7, R13, R14)
  - Acceptance: `joinParts` offsets segments by part start (5 s into a part at 1202 s → 1207 s, "20:07") and orders by `part_no` regardless of finish order, returning incomplete when a part isn't done; `applySpeakerRoles` maps letters per part and labels unmapped ones "Người nói n"; `capTranscript` at 30,000 chars (30,000 → no note, 30,001 → cut + note); `partPathsToDelete(parts)`.
  - Tests: `src/lib/transcript.test.ts` first with each case above.
  - Files: `src/lib/transcript.ts`, `src/lib/transcript.test.ts`
  - Lines (est.): 80 + 80 tests
  - Size: S
  - Depends on: none
- [ ] T6 Transcribe parts with retry (R5, R6, R15)
  - Acceptance: `transcribePart(partId)` downloads the part and calls OpenAI with `TRANSCRIBE_MODEL` (default `gpt-4o-transcribe-diarize`), `language: "vi"`, `diarized_json`, `chunking_strategy: "auto"`, then saves segments and `done`, or `failed` with the error; `useTranscription` runs pending/failed parts at most 3 at a time, reports "Đang chép lời n/N", and a retry calls only failed parts (1 request for 1 failed part of 12).
  - Tests: a failing test in `src/lib/transcript.test.ts` for the pure scheduler `nextParts(parts, running, max=3)` (skips done, picks failed/pending, never over 3). Network check in the preview for retry.
  - Files: `src/lib/ai/transcribe.ts`, `src/app/actions.ts`, `src/lib/use-transcription.ts`
  - Lines (est.): 170
  - Size: M
  - Depends on: T1, T5
- [ ] T7 Assign speaker roles and extract consultations (R7, R8, R9)
  - Acceptance: `assignSpeakers` returns `{part_no, letter → role}`; consultation prompt yields `document_type = consultation_recording` and a summary with the five `###` sections ("Không nhắc đến." when empty); the Omeprazole example from R8 gives the expected medication and `follow_up_date` = recordedOn + 14 days; `finishTranscript` saves the role-labelled transcript and moves the item to `needs_review` (inbox, with person/bệnh án/visit guesses) or `raw_ai_json` (visit document); `readInboxItem` / `readDocumentWithAI` route audio here; the photo/PDF prompt text is unchanged.
  - Tests: failing test for the pure `followUpFrom(recordedOn, days)` and the role application (from T5) wired in; model quality is checked on the user's m4a in T11's proof.
  - Files: `src/lib/ai/extract.ts`, `src/lib/services/inbox.ts`, `src/app/actions.ts`
  - Lines (est.): 200
  - Size: M
  - Depends on: T5, T6
- [ ] T8 Show the recording on the review screens (R10, R6)
  - Acceptance: both review screens show `AudioPlayer` (signed URL, `preload="metadata"`) and `Transcript` folded behind "Xem lời thoại (n phút)" with speaker and time per turn, read-only; `InboxRetry` shows part progress and "Chép lời lỗi k/N phần" with "Thử lại"; nothing saved before **Xác nhận**.
  - Tests: no unit test (UI); browser preview check with a seeded item (a done item and one with a failed part).
  - Files: `src/components/AudioPlayer.tsx`, `src/components/Transcript.tsx`, `src/components/ReviewForm.tsx`, `src/components/InboxReviewForm.tsx`, `src/components/InboxRetry.tsx`, `src/app/documents/[id]/review/page.tsx`, `src/app/inbox/[id]/review/page.tsx`
  - Lines (est.): 250
  - Size: M
  - Depends on: T6, T7
- [ ] T9 Show recordings on the visit page and clean up parts (R11, R14)
  - Acceptance: the visit page shows each recording in its own card (player, Markdown summary, transcript toggle); `PhotoGallery` skips audio; confirming, discarding or deleting removes the part files and rows, and deleting the document also removes the recording.
  - Tests: `partPathsToDelete` (T5) is used; storage listing in the preview shows no `parts/` files after confirm.
  - Files: `src/app/visits/[id]/page.tsx`, `src/components/PhotoGallery.tsx`, `src/lib/services/inbox.ts`, `src/app/actions.ts`
  - Lines (est.): 150
  - Size: M
  - Depends on: T8
- [ ] T10 Let the assistant read transcripts (R12, R13)
  - Acceptance: `get_visit` lists recordings with their summary; `read_transcript(document_id)` returns the transcript through `capTranscript`; instructions mention it; asking "bác sĩ dặn gì về thuốc ở lần khám 05/11?" uses it.
  - Tests: `capTranscript` (T5) covers the cap; one chat check in the preview.
  - Files: `src/lib/agent/tools.ts`, `src/lib/agent/instructions.ts`
  - Lines (est.): 60
  - Size: S
  - Depends on: T1, T5
- [ ] T11 Turn the feature on and update the docs (all R; CLAUDE.md docs rule)
  - Acceptance: the flag defaults on; `docs/ai.md` (recordings, transcription model), `docs/architecture.md` (code map, data model), `docs/assistant.md` (`read_transcript`), `docs/roadmap.md` change log and README updated; the full Proof passes with the user's m4a.
  - Tests: the Proof section (E2E with the real m4a, duplicate, over 2 h, part retry) plus `npm test`, `npx tsc --noEmit`, `npm run lint`.
  - Files: `src/lib/upload.ts` (flag default), `docs/ai.md`, `docs/architecture.md`, `docs/assistant.md`, `docs/roadmap.md`, `README.md`
  - Lines (est.): 110
  - Size: S
  - Depends on: T9, T10
  - Rollback: flag `NEXT_PUBLIC_AUDIO_UPLOADS` off.

## Test design

Written by `dev-flow:test-design` from the Goal and spec only (no source code). Status: locked.

| R-id | Test name (includes R-id) | Given | When | Then (expected) | Level | Task |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| R1 | `R1 format check accepts the six formats and rejects amr` | `a.m4a` (audio/mp4), `a2.m4a` (type `""`), `b.mp3`, `c.wav`, `d.webm`, `e.ogg`, `f.aac`; `ghi-am.amr` (audio/amr) | the format check runs on each | the seven supported files are accepted; `ghi-am.amr` gives exactly "Không đọc được file ghi âm này (hỗ trợ m4a, mp3, wav, webm, ogg, aac)." | unit | T2 |
| R1 | `R1 splits audio from photos, one group per audio` | (a) `kham-tim.m4a`, `anh-1.jpg`, `anh-2.jpg`; (b) `sang.m4a`, `chieu.mp3`; (c) `toa.jpg`, `kq.pdf` | the audio/photo split runs | (a) `[kham-tim.m4a]` + `[anh-1.jpg, anh-2.jpg]`; (b) 2 groups of 1; (c) 0 audio groups, 1 non-audio group | unit | T2 |
| R1 | `R1 audio is accepted in every picker` | sample 3-min `kham-tim.m4a` (audio/mp4) | picked in "+" → Tải ảnh / PDF / ghi âm, `DocumentUploader`, `NewVisitForm`, `AssistantChat` | no error in any; each starts an upload to the `documents` bucket | e2e | T4 |
| R1 | `R1 amr picked in "+" uploads nothing` | file `ghi-am.amr` | picked in "+" | the R1 message is shown; 0 storage upload requests; 0 new inbox items | e2e | T4 |
| R1 | `R1 1 audio + 2 photos create 2 inbox items` | `kham-tim.m4a`, `anh-1.jpg`, `anh-2.jpg` | picked together in "+" | 2 new inbox items: one with the audio, one with the 2 photos | e2e | T4 |
| R1 | `R1 failed part upload rolls back all files` | storage upload of part 2 forced to fail | uploading a 15-min `test.m4a` | "Tải lên lỗi, thử lại." shown; 0 objects left in storage for this upload | e2e | T4 |
| R2 | `R2 accepts 2:00:00 and rejects 2:00:01` | original durations 7200 s and 7201 s | the length check runs | 7200 → accepted; 7201 → exactly "Bản ghi dài hơn 2 giờ, hãy cắt bớt." | unit | T2 |
| R2 | `R2 unreadable duration gives the R1 message` | duration `NaN`, `null`, `Infinity` | the length check runs | each → exactly "Không đọc được file ghi âm này (hỗ trợ m4a, mp3, wav, webm, ogg, aac)." | unit | T2 |
| R2 | `R2 too-long or corrupted file uploads nothing` | 2:00:01 silent `dai.m4a`; `hong.m4a` (random bytes, audio/mp4) | each picked in "+" | `dai.m4a` → R2 message; `hong.m4a` → R1 message; 0 storage upload requests for both | e2e | T4 |
| R3 | `R3 compresses 30-min stereo m4a to 11 MB or less` | sample 30:00, 128 kbps stereo m4a (~29 MB) | duration read, then compressed for storage | original duration read as 1800 ± 1 s; output ≤ 11,534,336 bytes, 1 channel, ≤ 48 kbps, duration 1800 ± 1 s; plays in desktop Chrome `<audio>` (`loadedmetadata`, no `error`) | e2e | T3 |
| R3 | `R3 compressed file plays in iPhone Safari (manual)` | the compressed 30:00 file, real iPhone on iOS 26 Safari | played in the app's player | plays from start; shown length 30:00 ± 1 s | e2e (manual) | T3 |
| R3 | `R3 browser without WebCodecs audio shows message` | `AudioEncoder` undefined in the page | an audio file is picked | "Trình duyệt này chưa hỗ trợ ghi âm, hãy dùng Safari hoặc Chrome mới."; 0 uploads | e2e | T3 |
| R3 | `R3 same m4a again is a duplicate` | `kham-tim.m4a` already uploaded once | the same file is uploaded again | "File đã được tải lên trước đó: kham-tim.m4a"; 0 new storage objects | e2e | T4 |
| R4 | `R4 part count at 9:59, 10:00 and 10:01` | durations 599, 600, 601 s | parts are planned | 599 → 1 part (0–599); 600 → 1 part (0–600); 601 → 2 parts | unit | T2 |
| R4 | `R4 2:00:00 makes 12 contiguous parts of 10 min or less` | duration 7200 s | parts are planned | 12 parts; part 1 start 0; part 12 end 7200; each `end − start` ≤ 600; part n+1 start = part n end | unit | T2 |
| R4 | `R4 part over 24 MB is cut shorter at an extra point` | duration 1200 s, encoded at 400 kbps (30 MB per 10 min) | parts are planned | more than 2 parts; every part ≤ 25,165,824 bytes (24 MB); bitrate stays 400 kbps | unit | T2 |
| R4 | `R4 cut picks quietest 0.5 s in the window` | loudness per 0.5 s over 590–610 s, quietest at 604.0–604.5 | quiet point found for mark 600 | cut at 604.0 (± 0.5 s) | unit | T3 |
| R4 | `R4 window edge: +10 s accepted, +10.5 s ignored` | (a) quietest inside at 609.5–610.0; (b) silence at 610.5–611.0 and 589.0–589.5 (both outside), quietest inside at 595.0–595.5 | quiet point found for mark 600 | (a) cut at 609.5; (b) cut at 595.0 | unit | T3 |
| R4 | `R4 window uses fixed marks, not the previous cut` | first cut at 595 s; silence at 1186.0–1186.5 s, quietest inside 1190–1210 at 1205.0–1205.5 | quiet point found for the 2nd mark | cut at 1205.0 (window 1190–1210, not 1185–1205) | unit | T3 |
| R4 | `R4 encoded parts of a 2 h file stay under limits` | 2:00:00 sample in browser | parts are encoded | 12 blobs, each ≤ 24 MB and ≤ 600 s | e2e | T3 |
| R4 | `R4 joined segment times are offset and ordered` | parts given as 3, 1, 2; part 3 `start_sec` 1202, segment `start` 5 | parts are joined | segments in part order 1, 2, 3; that segment `start` = 1207 (20:07) | unit | T5 |
| R5 | `R5 transcription request uses diarize defaults and override` | mocked OpenAI client; `TRANSCRIBE_MODEL` unset, then `gpt-4o-transcribe` | one part is transcribed each time | unset → `model: "gpt-4o-transcribe-diarize"`; set → `"gpt-4o-transcribe"`; both have `response_format: "diarized_json"`, `chunking_strategy: "auto"`, `language: "vi"` | unit | T6 |
| R5 | `R5 scheduler never runs more than 3` | (a) 12 pending, 0 running; (b) 1–3 running; (c) 1–2 running, 3 done, 4–12 pending; (d) 1–11 done, 12 pending | the scheduler picks next parts | (a) [1, 2, 3]; (b) []; (c) [4]; (d) [12] | unit | T6 |
| R5 | `R5 progress label counts done parts` | 12 parts, 4 done, 3 running, 5 pending | the progress label is formatted | "Đang chép lời 4/12" | unit | T6 |
| R5 | `R5 12 parts run at most 3 at a time, each under 300 s` | 2:00:00 sample uploaded, real API | transcription runs | ≤ 3 `transcribePart` requests in flight at any time; 12 in total; each responds in < 300 s; screen shows "Đang chép lời n/12" with n = done parts | e2e | T6 |
| R6 | `R6 timeout on part 7 keeps the other 11` | 12 parts, mocked client throws timeout for part 7 | all parts transcribed, then retry picks parts | part 7 `failed` with an `error`; 1–6, 8–12 `done` with `segments`; label "Chép lời lỗi 1/12 phần"; retry picks [7] | unit | T6 |
| R6 | `R6 Thử lại calls OpenAI once` | inbox item with part 7 failed, 11 done | user presses "Thử lại" | exactly 1 OpenAI transcription call (part 7); then 12/12 done | e2e | T6 |
| R6 | `R6 transcript_parts constraints` | migration applied | insert (a) both `inbox_item_id` and `document_id`; (b) neither; (c) 2nd part_no 1 for item X; (d) part_no 1 for item Y; (e) `status = 'running'` | (a), (b), (c), (e) rejected; (d) succeeds; `pending`, `done`, `failed` accepted | integration | T1 |
| R7 | `R7 applies roles per part, unmapped become Người nói` | part 1 A, B, C; part 2 A, B; roles {1: {A: Bác sĩ, B: Bệnh nhân}, 2: {A: Người nhà, B: Bác sĩ}} (part 1 C unmapped); segment `{start:12, end:15, speaker:"A", text:"Dạo này anh ăn uống thế nào?"}` | roles applied | part 1 A → "Bác sĩ", B → "Bệnh nhân", C → "Người nói" (no number); part 2 A → "Người nhà", B → "Bác sĩ"; `text`, `start`, `end` unchanged | unit | T5 |
| R7 | `R7 invalid roles are dropped` | raw AI roles for part 1: A → "Y tá", B → "Bác sĩ" | roles parsed, then applied to part 1 segments A and B | parsed `{1: {B: "Bác sĩ"}}`; A → "Người nói", B → "Bác sĩ"; texts equal the input exactly | unit | T7 |
| R7 | `R7 doctor question maps A to Bác sĩ` | sample part 1: A "Dạo này anh ăn uống thế nào?", B "Dạ em ăn ít, hay đau bụng." | `assignSpeakers` runs on the real model | A → "Bác sĩ", B → "Bệnh nhân" | e2e | T7 |
| R8 | `R8 type is consultation_recording and summary has five sections` | mocked AI returns `document_type: "prescription"` and a summary with only `### Lý do khám` and `### Thuốc` | extraction runs with `{ transcript }` | `document_type` = "consultation_recording"; headings in order `### Lý do khám`, `### Bác sĩ nói gì`, `### Chẩn đoán`, `### Dặn dò`, `### Thuốc`; the three missing contain "Không nhắc đến." | unit | T7 |
| R8 | `R8 follow-up is recording date plus days` | recording date 2026-11-05 + 14; 2026-11-20 + 14 | follow-up date computed | "2026-11-19"; "2026-12-04" | unit | T7 |
| R8 | `R8 observation needs a test name and a number` | AI observations `{raw_name:"đường huyết", value:"7,2", unit:null}`, `{raw_name:"cholesterol", value:"5,1", unit:"mmol/L"}`, `{raw_name:"đường", value:"hơi cao"}`, `{raw_name:"", value:"6"}` | spoken observations cleaned | 2 kept: "đường huyết" "7,2" unit null; "cholesterol" "5,1" unit "mmol/L"; "hơi cao" and the nameless one dropped | unit | T7 |
| R8 | `R8 Omeprazole example on the real model` | transcript "uống Omeprazole 20mg sáng một viên trước ăn trong 14 ngày, 2 tuần sau tái khám. Đường huyết 7,2. Đường hơi cao.", recording date 2026-11-05 | extraction runs | medication `Omeprazole 20mg` / `1 viên` / `Sáng, trước ăn` / 14; `follow_up_date` "2026-11-19"; observations exactly 1: "đường huyết", "7,2", unit null | e2e | T7 |
| R8 | `R8 extraction failure keeps parts and retries only that step` | 12 parts done; mocked extraction throws once | `finishTranscript` runs, then retry | item `failed` with "Đọc bằng AI lỗi"; retry makes 0 transcription calls; 12 parts still `done` | e2e | T7 |
| R9 | `R9 recording date comes from lastModified` | `kham-tim.m4a` with `lastModified` 2026-11-05 09:30 local | uploaded via "+" | inbox item recording date = 2026-11-05 | unit | T4 |
| R9 | `R9 person suggested unless confidence is low` | `matched_person_id` "thanh-id" with `person_match_confidence` "high", "low", null | the person suggestion is computed | "high" → "thanh-id"; "low" → null; null → null | unit | T7 |
| R9 | `R9 Thanh's visit pre-selected from speech and date` | Thanh's visit 05/11/2026; recording dated 05/11/2026 saying "chị Thanh" | uploaded via "+" | review pre-selects Thanh and that visit | e2e | T7 |
| R10 | `R10 minutes label rounds up` | durations 1740 s (29:00), 1741 s (29:01), 1800 s (30:00) | the transcript label is formatted | "Xem lời thoại (29 phút)", "Xem lời thoại (30 phút)", "Xem lời thoại (30 phút)" | unit | T8 |
| R10 | `R10 review shows player, date and read-only transcript` | inbox item and visit-page upload from a 29:01 sample dated 05/11/2026; one segment at 1207 s "Bác sĩ" | each review screen opens and the transcript is unfolded | audio player shown; "05/11/2026" shown as recording date; folded behind "Xem lời thoại (30 phút)"; turn shows "20:07" and "Bác sĩ"; no `textarea`, `input` or `contenteditable` in the transcript | e2e | T8 |
| R10 | `R10 nothing saved before Xác nhận` | recording processed to review | before and after pressing "Xác nhận" | before: 0 new `documents` rows; after: 1 row with `doc_type = consultation_recording` and non-null `transcript` | e2e | T8 |
| R11 | `R11 visit page shows recording card, toggle, no gallery item` | visit with 2 photos and 1 confirmed recording | visit page opens; "Xem lời thoại" pressed twice | player shown; summary headings "Lý do khám", "Bác sĩ nói gì", "Chẩn đoán", "Dặn dò", "Thuốc" rendered (no literal `###`); 1st press shows turns, 2nd hides; gallery has 2 items | e2e | T9 |
| R12 | `R12 search finds transcript words and ghi âm` | recording doc with "Omeprazole" only in the transcript; 2nd recording; 1 photo doc | member calls `search_records('omeprazole')`, `('ghi âm')`, `('paracetamol')`; non-member calls `('omeprazole')` | 'omeprazole' → the 1st recording; 'ghi âm' → both recordings, not the photo; 'paracetamol' → 0 rows; non-member → 0 rows | integration | T1 |
| R13 | `R13 cap at 30,000 and note at 30,001` | transcript texts of 30,000 and 30,001 characters | capped | 30,000 → unchanged, no note; 30,001 → first 30,000 followed by "[Đã cắt: còn 1 ký tự]" | unit | T5 |
| R13 | `R13 read_transcript and get_visit expose the recording` | visit with 1 recording whose transcript is 30,005 characters | `read_transcript(document_id)`; `get_visit` | first 30,000 chars + "[Đã cắt: còn 5 ký tự]"; `get_visit` lists the recording with `doc_type` "consultation_recording" and its summary | integration | T10 |
| R13 | `R13 assistant answers from the transcript` | Thanh's visit 05/11/2026 with sample transcript "uống Omeprazole 20mg sáng một viên trước ăn trong 14 ngày" | user asks "bác sĩ dặn gì về thuốc ở lần khám 05/11?" | assistant calls `read_transcript`; answer mentions "Omeprazole 20mg", "1 viên", "trước ăn", "14 ngày" | e2e | T10 |
| R14 | `R14 lists part paths only` | parts `p/1.m4a`, `p/2.m4a`, `p/3.m4a`, recording `r/main.m4a`; and a case with 0 parts | part paths to delete listed | `["p/1.m4a","p/2.m4a","p/3.m4a"]` (no `r/main.m4a`); 0 parts → `[]` | unit | T5 |
| R14 | `R14 confirm keeps only the recording` | inbox item with 2 parts | "Xác nhận" | 0 `transcript_parts` rows; 0 part objects; compressed recording object remains | e2e | T9 |
| R14 | `R14 discard removes recording, parts and transcript` | inbox item with 2 parts and a transcript | item discarded | 0 `transcript_parts` rows; 0 part objects; recording object gone; no row holds its transcript | e2e | T9 |
| R14 | `R14 deleting the document deletes recording and transcript` | confirmed recording document | document deleted | its `document_files` row and storage object gone; no row holds its transcript | integration | T9 |
| R15 | `R15 speaker and extraction calls send store false` | mocked OpenAI client | `assignSpeakers` and extraction run | every request has `store: false` | review | T7 |
| R15 | `R15 audio signed URLs last 1 hour` | a recording on the review screen | the page loads | the sign request for bucket `documents` has `expiresIn` 3600 | e2e | T8 |
| R15 | `R15 documents bucket private and parts members-only` | migration applied, parts for a member's item | read bucket `documents`; anonymous fetch of a recording path; non-member selects `transcript_parts` | `public = false`; fetch returns 400 or 403; 0 rows | integration | T1 |
| R1 | `R1 goal: sample m4a through "+" reaches a searchable visit` | feature on (T11), made-up 5-min consultation `kham-mau.m4a` mentioning "omeprazole" | uploaded via "+", reviewed, "Xác nhận" | review shows transcript, the five summary sections and advice as to-dos; visit page plays audio and shows summary; `search_records('omeprazole')` returns that document | e2e | T11 |

Levels: `unit` = locked tests below; `integration` = SQL on a Supabase branch; `e2e` = browser preview (manual where noted); `review` = checked in code review.

Locked tests (25, failing with "not implemented" on 2026-11-09): `src/lib/audio-plan.test.ts` (11), `src/lib/transcript.test.ts` (8), `src/lib/consultation.test.ts` (5), `src/lib/ai/transcribe.test.ts` (1). Stubs: `src/lib/audio-plan.ts`, `src/lib/transcript.ts`, `src/lib/consultation.ts`, `src/lib/ai/transcribe.ts`. Pure helpers live in `audio-plan.ts` / `consultation.ts` beside the tasks' files so Node can test them.
Approval: automatic (priority medium).

## Risks

- **Riskiest step: 1 (migration).** It replaces `search_records`. Mitigation: copy the latest body unchanged plus two additions, test on a Supabase branch first, and keep the down SQL ready. Production is applied as described in `docs/development.md`, only after your OK.
- **Step 2 on iPhone.** WebCodecs audio encoding on iOS: checked early on a real iPhone (installed PWA) before steps 3-8 are built on it.
- **Step 5 quality.** Vietnamese diarization may be weak; `TRANSCRIBE_MODEL` can switch to `gpt-4o-transcribe` (no speakers) and R7 then labels turns by content.

## Proof (verification)

Unit (`npm test`): `audio.test.ts` (part plan boundaries 9:59/10:01/2:00:00/2:00:01, cut window, formats), `transcript.test.ts` (offsets, order, roles, cap).

E2E (browser preview, dev server):
- your real m4a through "+": progress shown, review screen with the player, transcript and sectioned summary, to-dos and medications; **Xác nhận** → visit page plays it; search for a spoken drug name finds it;
- the same file again → duplicate message;
- a recording over 2 h → error before upload;
- part failure: simulate one failed part, then "Thử lại" calls OpenAI for that part only (network log).

Checks: `npm test`, `npx tsc --noEmit`, `npm run lint`, with output shown.

Manual: on an iPhone (installed app), upload one voice memo and play it back on the visit page.
