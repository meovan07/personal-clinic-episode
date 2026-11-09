# AI features

All OpenAI calls run on the server with `store: false`, so medical data isn't kept on OpenAI's side. The chat assistant has its own doc: [assistant.md](assistant.md).

## Document extraction

Ways in:
- **From a visit's page:** upload the pages of one document, then **Đọc bằng AI**.
- **"Thêm lần khám"** (`NewVisitForm.tsx`) leads with the photo: attaching it creates the visit, uploads and reads it right away, and fills in the date, facility, khoa and bác sĩ for you. Saving with no photo works like a plain form.
- **"+" → Tải ảnh / PDF** and **a file sent to the assistant:** the upload goes to the inbox first, and the AI also guesses whose document it is, which bệnh án it continues and which existing visit it belongs to (same person and date, and the same facility when both have one).

How it works:
1. The server sends the files to OpenAI (`src/lib/ai/extract.ts`) with a strict JSON schema. The model copies names, values, units and ranges exactly as printed and never converts anything.
2. The **review screen** (`/documents/[id]/review`, or `/inbox/[id]/review` for inbox uploads) shows the original next to editable fields. Nothing is saved until **Xác nhận**. From the assistant, an approval card plays this role, with a link to the same review page for corrections.
3. On confirm, `applyExtraction` (`src/lib/services/inbox.ts`) and `src/lib/normalize.ts` do the maths in code, not in the model:
   - match test names to `test_catalog` (aliases, with or without diacritics);
   - convert units with `unit_conversions`, e.g. mg/dL → mmol/L (the printed value stays in `raw_value` / `raw_unit`);
   - parse reference ranges (`3,9 - 6,4`, `< 5.18`, `(≤ 40)`) and recompute high/low;
   - turn the doctor's advice and the follow-up date into to-dos;
   - save vaccination doses (skipping doses already recorded from another photo of the same card), mark whether the vaccine is typically single-dose, and turn a future next-dose date into a to-do;
   - fill in visit fields that were left blank.

   Confirming again replaces the rows created from that document.

To add a test to the catalog, insert a row into `test_catalog` (and `unit_conversions` if labs print it in another unit). `npm test` runs the normalization tests.

## Consultation recordings

Doctor consultations recorded on a phone (m4a, mp3, wav, webm, ogg, aac, up to 2 hours) go in wherever photos do: the visit page, "Thêm lần khám", "+" and the chat. Turned off with `NEXT_PUBLIC_AUDIO_UPLOADS=0`. Design and decisions: `docs/features/audio-recordings/`.

1. **In the browser** (`src/lib/audio.ts`, mediabunny): the recording is re-encoded to mono 48 kHz AAC at 48 kbps (Opus/WebM where AAC can't be encoded) and cut into parts of about 10 minutes at the quietest half second near each mark (`src/lib/audio-plan.ts`, tested). The compressed recording and its parts are uploaded; the duplicate check uses the original's hash, and the file's date is kept as `recorded_on`.
2. **Transcription** (`src/lib/ai/transcribe.ts`): one server request per part, at most 3 at a time, Vietnamese, with speaker labels (`gpt-4o-transcribe-diarize`, `diarized_json`). A failed part keeps the others; "Thử lại" redoes only the failed ones. The transcription endpoint has no `store` option.
3. **Speaker roles** (`assignSpeakers` in `extract.ts`): one structured call turns each part's speaker letters into Bác sĩ, Bệnh nhân, Người nhà or Khác without rewriting the text; unknown speakers show as "Người nói".
4. **Reading** (`extractConsultation` / `extractAndMatchConsultation`): the role-labelled transcript goes through the usual extraction schema with a five-section Markdown summary (Lý do khám, Bác sĩ nói gì, Chẩn đoán, Dặn dò, Thuốc). A spoken value becomes a result only with a test name and a number; "2 tuần sau" comes back as a number of days and the follow-up date is computed in code (`src/lib/consultation.ts`, tested). In "+" the person is suggested only when the AI is confident. A recording with no speech stops with "Không nghe được lời nói nào trong bản ghi."
5. **Review and after:** the review screen shows the date, an audio player and the folded transcript next to the editable fields; nothing is saved until **Xác nhận**. Then the temporary parts are deleted; the recording, its summary and transcript stay on the visit, search covers the transcript, and the assistant reads it with `read_transcript`. Public pages show a recording's summary and audio like a photo, never the transcript.

### Transcription models (09/11/2026)

Tried on two of the owner's recordings (1:54 and 5:12; both had clear speech only at the start):

| Model | Result |
| :-- | :-- |
| **`gpt-4o-transcribe-diarize`** (default) | Vietnamese, Bác sĩ / Bệnh nhân told apart, sensible to-dos from the spoken part; wording varies between runs |
| `gpt-4o-transcribe` | the spoken part, then drifted into Indonesian, Korean and made-up lines |
| `whisper-1` | only a repeated "đăng ký kênh" hallucination |

`TRANSCRIBE_MODEL` switches the model (plain models get `json`; only `gpt-*` models get `chunking_strategy`).

## Other AI features

- **Tóm tắt sức khỏe** (person page, `src/lib/ai/summarize.ts`): a "what changed" summary from the person's visits, results, medications, vaccinations and the previous summary. Rendered as Markdown (`HealthSummary.tsx`), highlighting sparingly: only an abnormal value, a drug name or a date, never whole sentences.
- **To-do wording** (`src/lib/ai/polish.ts`): a new to-do is rewritten into a short, clear instruction. When a to-do is edited with added context, the AI gets the family roster and the person's recent visits and bệnh án, so it can resolve "chồng" to a real name or a vague test to what was actually recorded.

## Models

| Use | Setting | Default | Notes |
|---|---|---|---|
| Document extraction | `OPENAI_MODEL` | `gpt-6-luna` | Benchmarked below |
| Health summary, to-do wording | `OPENAI_MODEL` | `gpt-5.5` | Not benchmarked yet. Setting `OPENAI_MODEL` changes these too |
| Chat assistant, its compaction and memory | `CHAT_MODEL` | `gpt-6-luna` | Benchmarked below |
| Recording transcription | `TRANSCRIBE_MODEL` | `gpt-4o-transcribe-diarize` | Compared above |
| Recording speaker roles and reading | `OPENAI_MODEL` | `gpt-6-luna` | Same model as document extraction |

Prices per 1M tokens (input / output): gpt-5.5 $5 / $30 · gpt-6.1-sol $2 / $10 · gpt-5.4-mini $0.75 / $4.50 · gpt-6-luna $0.10 / $0.50.

### Extraction benchmark (02/10/2026)

5 already-reviewed documents (two phone-photo lab sheets with 26 and 47 values, a Medilab PDF, a VNVC vaccination card, a visit note), graded against the reviewed values:

| Model | Lab values (86) | Vaccine doses (5) | Avg time | Cost, 5 docs |
|---|---|---|---|---|
| gpt-5.5 (previous default) | 86/86 | 5/5 | 12 s | $0.310 |
| **gpt-6-luna** | 86/86 | 5/5 | 13 s | $0.006 |
| gpt-6.1-sol | 86/86 | 2/5 | 21 s | $0.110 |
| gpt-5.4-mini | 85/86 | 4/5 | 7 s | $0.050 |

The gold values started as gpt-5.5 output (then reviewed by hand), so the comparison slightly favours it; gpt-6-luna still matched every value and dose at ~1/50 of the cost. `extractDocument` takes an optional `model`, so the benchmark can be re-run.

### Chat benchmark (01/10/2026)

Same agent and tools, 7 real questions about the records, including traps (a test with only one result, a diagnosis question with no data, a request to change something while the assistant was read-only):

| Model | Avg time | Cost for all 7 | Answers |
|---|---|---|---|
| gpt-5.5 | 6 s | $0.13 | correct |
| gpt-6.1-sol | 11 s | $0.04 | correct, best structured (tables) |
| gpt-5.4-mini | 6 s | $0.025 | correct |
| **gpt-6-luna** | 5 s | $0.002 | correct, shortest |

All four handled the traps. gpt-6-luna was chosen (about 65× cheaper than gpt-5.5), with gpt-6.1-sol as the fallback if answers turn out too thin.
