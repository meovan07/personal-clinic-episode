## Audio recordings, slice 1/6: database and part planning

Part of "Upload a consultation recording and get a transcript and summary" (`docs/features/audio-recordings/`). Previous slice: none. Next slice: 2/6 (browser audio and upload, behind a flag). Depended on by: slices 2–6.

### What
- **T1** (R8, R12, R14): migration `20261109010000_audio_recordings`:
  - adds `consultation_recording` to `documents.doc_type`;
  - adds `transcript jsonb` to `documents` and `inbox_items`;
  - creates `transcript_parts` (RLS "members only", exactly one owner, unique part number per owner);
  - `search_records` now also matches transcript words and "ghi âm" (2 lines differ from the current body).
  
  Types are updated by hand.
- **T2** (R1, R2, R4, R9): `src/lib/audio-plan.ts`, pure helpers: format check, the 2-hour cap, the 10-minute part plan with quiet-point cuts and the 24 MB split, splitting audio from photos, and the recording date in Vietnam time.

Nothing user-visible: nothing calls the helpers yet, and nothing reads the new columns.

### Tests
- `npx tsx --test src/lib/audio-plan.test.ts`: 11/11 pass. These are locked tests from the test design; each went red when the code was replaced.
- SQL on a local Supabase:
  - the constraints reject a part with both owners, with no owner, with a duplicate part number, or with status `running`;
  - search: `omeprazole` finds the recording only through its transcript; `ghi âm` finds recordings but not the photo; a non-member gets 0 rows.
- The rollback script was applied locally: recordings are kept as `other`.
- `npx tsc --noEmit` and `npx eslint src` pass.

### Review
Round 1 (Opus, inline): 0 Critical, 0 Major, 2 Minor (one fixed; the other is planned for T3), 1 Nit. Confidence 91/100. See `review/round-1.md`.

### Deploy
- Apply the migration to the hosted project only after the owner's OK. This slice's code doesn't depend on it.
- Rollback:
  - code: revert;
  - database: `supabase/rollbacks/20261109010000_audio_recordings.down.sql` (export transcripts first).

### Open
The public-read feature (already on `main`) must keep `consultation_recording` files and transcripts off the public pages.
