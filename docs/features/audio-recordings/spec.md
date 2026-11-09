# Spec: Upload a consultation recording and get a transcript and summary

From: intent.md (Hung). Status: approved. Approved: 2026-11-09.

## Requirements

- R1. Audio is accepted wherever photos/PDFs are: visit page (`DocumentUploader`), "Thêm lần khám" (`NewVisitForm`), "+" → Tải ảnh / PDF / ghi âm (`QuickAddButton`), chat attachment (`AssistantChat`).
  - Given the "+" picker, when the user picks `kham-tim.m4a` (audio/mp4), then it is accepted and the upload starts.
  - Accepted: m4a, mp3, wav, webm, ogg, aac. Given `ghi-am.amr`, then error "Không đọc được file ghi âm này (hỗ trợ m4a, mp3, wav, webm, ogg, aac)." and nothing is uploaded.
  - Given 1 audio and 2 photos picked together, then the audio becomes its own document/inbox item and the photos another (grill R11).
- R2. Total length of the original file is at most 2 hours, checked in the browser before anything is uploaded.
  - Boundary: 2:00:00 → accepted; 2:00:01 → error "Bản ghi dài hơn 2 giờ, hãy cắt bớt." and nothing is uploaded.
  - Given a file whose duration can't be read, then the R1 error.
- R3. The stored copy is re-encoded in the browser to mono, at most 48 kbps, and plays back in iPhone Safari and desktop Chrome.
  - Given a 30-min 128 kbps stereo m4a (~29 MB), when uploaded, then the stored file is ≤ 11 MB and its duration is within 1 s of the original.
  - Duplicate detection hashes the original (as for photos): uploading the same m4a again → "File đã được tải lên trước đó: kham-tim.m4a".
- R4. For transcription the audio is split into parts of about 10 minutes (at most 610 s, since a cut can move up to 10 s) and at most 24 MB each, cut at the quietest 0.5 s within ±10 s of each 10-minute mark.
  - Given a 9:59 recording, then 1 part. Given 10:00, then 1 part. Given 10:01, then 2 parts. Given 2:00:00, then 12 parts.
  - The ±10 s window is measured from the fixed marks (600 s, 1200 s, …), not from the previous cut. A part that would exceed 24 MB is cut shorter at an extra quiet point instead of lowering quality.
  - Each part keeps its start offset, so segment times in the joined transcript are relative to the whole recording (a segment 0:05 into part 3 that starts at 20:02 shows as 20:07).
- R5. Each part is transcribed by OpenAI in Vietnamese with speaker labels (`gpt-4o-transcribe-diarize`, `response_format: diarized_json`, `chunking_strategy: auto`), one server request per part, all under 300 s.
  - Given 12 parts with 4 done, then the screen shows "Đang chép lời 4/12" (n = parts done), and the parts run at most 3 at a time.
  - Model is set by `TRANSCRIBE_MODEL` (default `gpt-4o-transcribe-diarize`), so a plain model can be swapped in if Vietnamese diarization is poor (open question 1).
- R6. A failed part doesn't lose the finished ones; "Thử lại" redoes only the failed parts.
  - Given 12 parts where part 7 fails (timeout), then parts 1–6 and 8–12 are saved, the item shows "Chép lời lỗi 1/12 phần" with "Thử lại", and pressing it calls OpenAI once (part 7 only).
- R7. Once every part is done, the AI turns speaker letters into roles: Bác sĩ, Bệnh nhân, Người nhà, Khác, mapped per part (letters restart each part), without rewriting the text.
  - Given part 1 speaker A asks "Dạo này anh ăn uống thế nào?" and B answers, then A → Bác sĩ, B → Bệnh nhân.
  - When unsure, the label is "Người nói" (no number, since letters restart each part).
- R8. Extraction runs on the joined transcript with the existing `Extraction` schema, `document_type = consultation_recording`, and `summary` as Markdown with the sections `### Lý do khám`, `### Bác sĩ nói gì`, `### Chẩn đoán`, `### Dặn dò`, `### Thuốc`; a section with nothing said becomes "Không nhắc đến."
  - Given "uống Omeprazole 20mg sáng một viên trước ăn trong 14 ngày, 2 tuần sau tái khám", then medications has `Omeprazole 20mg` / `1 viên` / `Sáng, trước ăn` / 14, and `follow_up_date` = recording date + 14 days.
  - A spoken value becomes an observation only with a test name and a number: "đường huyết 7,2" → `raw_name` "đường huyết", `value` "7,2", `unit` null (filled on review). "đường hơi cao" → no observation.
- R9. In "+" and chat, the person, bệnh án and visit are guessed like photos, using names spoken and the recording date (the file's `lastModified`, shown on review); the model's `person_match_confidence = "low"` → person left blank (grill R14).
  - Given Thanh's visit on 05/11/2026 exists and a recording dated 05/11/2026 says "chị Thanh", then that visit is pre-selected.
- R10. The review screen (inbox and visit) shows an audio player, the transcript folded behind "Xem lời thoại (n phút)" (n = minutes rounded up: 29:01 → 30) with speaker and time per turn, read-only, next to the usual editable fields. Nothing is saved until **Xác nhận**.
- R11. The visit page shows each recording with a player, its summary rendered as Markdown, and a "Xem lời thoại" toggle.
- R12. Search finds words spoken in the recording: `search_records('omeprazole')` returns the recording's document when only the transcript contains it. "ghi âm" matches all recordings.
- R13. The assistant can read a recording: `get_visit` lists it with its summary; a new `read_transcript(document_id)` returns the transcript (first 30,000 characters; when cut, followed by "[Đã cắt: còn N ký tự]").
  - Given "bác sĩ dặn gì về thuốc ở lần khám 05/11?", then the assistant answers from the transcript.
- R14. Part files are temporary: deleted when the item is confirmed or discarded. After confirm only the compressed recording stays; discarding removes the recording, parts and transcript. Deleting the document deletes the recording and its transcript.
- R15. Every OpenAI Responses call (speaker roles, extraction) uses `store: false`; the transcription endpoint has no `store` option (checked in SDK 7.23 types), which `docs/ai.md` will say; audio is only in the private `documents` bucket and reached through 1-hour signed URLs.

## Design

- **Browser** (`src/lib/audio.ts`, new): read duration, re-encode for storage, find cut points, encode parts. Uses WebCodecs through a small library (the choice goes in plan.md Approach). Called from `upload.ts`, which already holds the hash → duplicate check → upload → rollback pipeline.
- **Server**:
  - `src/lib/ai/transcribe.ts` (new): one part → diarized segments.
  - `src/lib/ai/extract.ts`: `extractDocument` / `extractAndMatchDocument` also accept `{ transcript }`; the consultation prompt; `assignSpeakers()`.
  - Server actions: `transcribePart(partId)`, `finishTranscript(owner)` (joins parts, assigns roles, runs extraction).
  - `src/lib/services/inbox.ts`: `saveInboxItem` copies the transcript to the document; part files are cleaned up.
- **Data** (one migration):
  - `documents.doc_type` adds `consultation_recording`.
  - `documents.transcript jsonb` and `inbox_items.transcript jsonb`: `[{start, end, speaker, text}]`, joined and role-labelled.
  - New `transcript_parts`: `id`, `inbox_item_id` or `document_id` (exactly one), `part_no`, `storage_path`, `start_sec`, `end_sec`, `status` (`pending|done|failed`), `segments jsonb`, `error`, unique (owner, part_no). RLS members only, like `inbox_files`.
  - `search_records`: the document branch adds the transcript text and the keyword "ghi âm buổi khám" for `consultation_recording`.
  - `src/lib/database.types.ts` updated by hand.
- **UI**:
  - `AudioPlayer` and `Transcript` components (new).
  - `ReviewForm`, `InboxReviewForm`, `InboxRetry` (part progress and retry), visit page, `PhotoGallery` skips audio (recordings render in their own card).
- **Auth**: unchanged; every call runs as the signed-in member with RLS.

## Errors

| Case | Response |
| :---- | :---- |
| Unsupported or undecodable audio | R1 message, nothing uploaded |
| Longer than 2 h | R2 message, nothing uploaded |
| Duplicate (same original hash) | existing duplicate message |
| Upload of the recording or a part fails | rollback of all uploaded files (existing `rollbackUpload`), "Tải lên lỗi, thử lại." |
| OpenAI error or timeout on a part | part `failed` with the message; R6 retry |
| Speaker roles or extraction fail | item `failed`, "Đọc bằng AI lỗi"; retry reruns only this step (parts are kept) |
| Browser without WebCodecs audio | "Trình duyệt này chưa hỗ trợ ghi âm, hãy dùng Safari hoặc Chrome mới." |

## How each constraint in the intent is met

| Constraint | Met by |
| :---- | :---- |
| 25 MB per OpenAI request | R4 |
| 300 s per server function | R5 (one part per request) |
| 1 GB free storage | R3, R14 |
| 2 h cap | R2 |
| Medical data privacy | R15, R10 (nothing saved before confirm) |
| No in-app recording, no transcript editing | out of scope, R10 read-only |

## Open questions from the intent

- Model and Vietnamese diarization quality: R5 makes the model configurable; still open until tested on the user's m4a.
- Overlap vs silence: answered by R4 (quietest point, no overlap).
- Where transcription runs: answered by R5 (the browser drives one server request per part). How the audio is processed in the browser is chosen in plan.md.

## Out of scope

- Recording inside the app, editing the transcript, translation, recordings longer than 2 h.

## Areas of concern

- Older iPhones (iOS < 26) may lack WebCodecs audio encoding; the Errors table covers it, but a member on an old phone can't upload recordings.
- The browser must stay open while the parts upload (transcription continues on retry if the tab closes).

## Decisions

- Long audio: split in the browser (R4). Decided by Hung, 2026-11-09.
- Keep compressed audio (R3), read-only transcript (R10), retry failed parts (R6), structured summary (R8), searchable transcript (R12, R13). Decided by Hung, 2026-11-09.
- Test-design gaps (09/11/2026): spoken values need a test name + number (R8), discard deletes everything (R14), unknown speakers are "Người nói" (R7). Decided by Hung. Progress counts done parts, minutes round up, cut note wording, fixed ±10 s marks, shorter part over 24 MB, confidence from the model's `low`: defaults set by Claude, same date.
- Public pages (public read access feature): a confirmed recording shows like a photo, so its summary and audio file are public; the transcript stays members-only (`public_visit` doesn't return it). Decided by Hung, 2026-11-09; checked in T11.
