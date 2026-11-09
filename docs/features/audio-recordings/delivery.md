# Delivery: Upload a consultation recording and get a transcript and summary

Plan: plan.md. Merge request: slice 1/6 [#3](https://github.com/meovan07/personal-clinic-episode/pull/3) (#2 closed: it was cut from the public-read branch by mistake). Status: in review.

## Test evidence

### Slice 1/6 (T1, T2), 2026-11-09

| Check | Command | Result |
| :-- | :-- | :-- |
| test (slice) | `npx tsx --test src/lib/audio-plan.test.ts` | 11 passed, 0 failed |
| test (all) | `npm test` | 74 tests: 60 passed, 14 failed. All 14 are locked tests of later slices (`transcript`, `consultation`, `transcribe`), still "not implemented" |
| typecheck | `npx tsc --noEmit` | pass |
| lint | `npx eslint src` | pass. `npm run lint` fails only on generated `.next` files inside `.claude/worktrees/public-read-access/` (another feature's worktree), not on this code |
| format | none configured | not run |
| SQL (T1) | local Supabase (`npx supabase start`, `db reset`), checks in a rolled-back transaction | all pass (see Traceability) |

### Traceability

| R-id | Test | Result |
| :-- | :-- | :-- |
| R1 | `src/lib/audio-plan.test.ts` "R1 format check accepts the six formats and rejects amr", "R1 splits audio from photos, one group per audio" | pass |
| R2 | `src/lib/audio-plan.test.ts` "R2 accepts 2:00:00 and rejects 2:00:01", "R2 unreadable duration gives the R1 message" | pass |
| R4 | `src/lib/audio-plan.test.ts` "R4 part count at 9:59, 10:00 and 10:01", "R4 2:00:00 makes 12 contiguous parts of 10 min or less", "R4 part over 24 MB is cut shorter at an extra point", "R4 cut picks quietest 0.5 s in the window", "R4 window edge: +10 s accepted, +10.5 s ignored", "R4 window uses fixed marks, not the previous cut" | pass |
| R9 | `src/lib/audio-plan.test.ts` "R9 recording date comes from lastModified" | pass |
| R6 (data) | SQL "R6 transcript_parts constraints": both owners / neither / duplicate part_no / status `running` rejected; other owner accepted | pass (local) |
| R12 | SQL "R12 search finds transcript words and ghi âm": `omeprazole` → recording 1 only; `ghi âm` → both recordings, not the photo; `paracetamol` → none; non-member → 0 rows | pass (local) |
| R15 (data) | SQL: non-member sees 0 `transcript_parts` rows | pass (local) |

R3, R5-R8, R10, R11, R13, R14: later slices.

Orphan tests (new or changed, no R-id): none.

### Mutation check

Tool: fallback (production code replaced per function, locked tests re-run, file restored and compared byte for byte).
Result: T2: all 11 tests went red (8 with every function throwing, 3 with `planParts` returning one part). T1: the down SQL applied on a reset DB removed the table, columns and search hit (by the T1 subagent).
Survivors: none.

Not run / not verified:
- The R15 row "documents bucket private, anonymous fetch refused": not checked in slice 1, so it will be checked with T8.
- The migration has not been applied to the hosted project, and won't be until you OK it.
- The T1 rollback was changed in review to keep recordings as `other` instead of deleting them, then re-run locally: a `consultation_recording` row became `other`, exit 0.

## Review rounds

| Round | Reviewer (session / subagent) | Critical | Major | Minor | Nit | Confidence (0-100) | File |
| :-- | :-- | --: | --: | --: | --: | --: | :-- |
| 1 (slice 1) | Opus, inline | 0 | 0 | 2 | 1 | 91 | `review/round-1.md` |

Final confidence (slice 1): 91/100. Open findings: Minor 1 (planParts guard and R4 wording, done in T3). Minor 2 fixed (export note added to the rollback).
Cross-feature, open with the user: the public-read feature (on `main`) must not show `consultation_recording` files or transcripts on public pages.

## Release notes (slice 1/6)

Nothing changes for users yet. This slice prepares the database for consultation recordings and adds the logic that plans how a long recording is split for transcription.

## Deploy checklist (slice 1/6)

- Migration: `supabase/migrations/20261109010000_audio_recordings.sql`. Apply to the hosted project (`npx supabase db push` or MCP `apply_migration`) **after the owner's OK**, then check the security advisor. The code in this slice doesn't depend on it, so either order is safe.
- Config/env: none in this slice (`TRANSCRIBE_MODEL` and `NEXT_PUBLIC_AUDIO_UPLOADS` come later).
- Feature flags: none yet.
- Order: merge, then apply the migration (or the other way round; nothing reads the new columns yet).
- Smoke checks after the migration: search for a known word (e.g. a test name) returns the same results as before; `select count(*) from public.transcript_parts` works for a member.
- Rollback: code: revert the merge commit. Migration: run `supabase/rollbacks/20261109010000_audio_recordings.down.sql` in the SQL editor (export transcripts first if any exist; recordings become `other`).

## Merge decision (slice 1/6)

| # | Condition | Value | Result |
| :-- | :-- | :-- | :-- |
| 1 | `auto_merge.enabled` | false (default) | fail |
| 2 | confidence ≥ 90 | 91 | pass |
| 3 | no Critical/Major open | none | pass |
| 4 | ≤ 150 lines, ≤ 5 files | 1212 lines, 14 files | fail |
| 5 | no `risky_paths` | `supabase/migrations/` changed | fail |
| 6 | CI green | Vercel preview pending at push | not evaluated |
| 7 | priority not critical | medium | pass |
| 8 | autonomy on, no STOP | yes | pass |
| 9 | rollback ready | down SQL + checklist filled | pass |

Result: left open for a human merge.

Review budget: 5 code files (14 with docs), ~549 weighted code lines out of 400. It's over because the full `search_records` body (~130 lines) is copied into both the migration and the rollback; the actual change is 2 lines. Auto-merge limit: 14 out of 5 files, 1212 out of 150 lines → human merge.

## Slice 2/6 (2a: T3, 2b: T4), 2026-11-09

### Test evidence

| Check | Command | Result |
| :-- | :-- | :-- |
| test (slice) | `npx tsx --test src/lib/audio-plan.test.ts` | 13 passed, 0 failed |
| test (all) | `npm test` | 72 tests: 58 passed, 14 failed (later-slice locked tests, "not implemented") |
| typecheck | `npx tsc --noEmit` | pass |
| lint | `npx eslint src` | pass |
| browser (flag on, local Supabase) | "+" upload of the user's 1:54 m4a and an 18-min test file | pass after a fix (see review round 2) |

### Traceability

| R-id | Test | Result |
| :-- | :-- | :-- |
| R1 | "R1 mixed pick gives audio items and one photo group" (unit); browser: `accept` includes `audio/*`, m4a accepted in "+" | pass |
| R2 | browser: the original's duration is read before upload (1:54 and 18:23 accepted) | pass; the over-2 h case is covered only by the unit test |
| R3 | browser: stored copy mono 48 kHz, 722 KB (1:54) and 6.9 MB (18:23), ~48.6 kbps including container overhead | pass |
| R4 | "R4 planParts rejects unreadable durations" (unit); browser: 18:23 → 2 parts, cut at 603.0 s | pass |
| R9 | browser: `recorded_on` saved from the file date (2026-11-09 and 2026-11-05) | pass |
| R14 | browser: parts under `inbox/parts/`, `transcript_parts` rows `pending` | pass |

Orphan tests: none.

### Mutation check

Removing the `planParts` guard turns "R4 planParts rejects unreadable durations" red; file restored and compared byte for byte.

Not run / not verified: iPhone Safari (needs your phone); flag-off in the browser (verified by code); the duplicate message in the browser.

Review: round 2, confidence 88/100. Majors (slice size, mono/bitrate bug) fixed; 2 Minors open behind the flag (T7, T8/T11).

## Slice 3/6 (T5, T6), 2026-11-09

| Check | Command | Result |
| :-- | :-- | :-- |
| test (slice) | `npx tsx --test src/lib/transcript.test.ts src/lib/ai/transcribe.test.ts` | 9 passed, 0 failed |
| test (all) | `npm test` | 72 tests: 67 passed, 5 failed (slice-4 locked tests, "not implemented") |
| typecheck / lint | `npx tsc --noEmit`, `npx eslint src` | pass |

Traceability: R4 "R4 joined segment times are offset and ordered"; R5 "R5 scheduler never runs more than 3", "R5 progress label counts done parts", "R5 transcription request uses diarize defaults and override"; R6 "R6 timeout on part 7 keeps the other 11"; R7 "R7 applies roles per part, unmapped become Người nói"; R10 "R10 minutes label rounds up"; R13 "R13 cap at 30,000 and note at 30,001"; R14 "R14 lists part paths only". All pass. Orphan tests: none.

Mutation check: offset, concurrency limit, minute rounding and language mutants all turn tests red; files restored.

Not verified: transcription with the real model (Claude can't load `.env.local`; the owner can run the probe, otherwise it's covered in slice 5's browser check); the R5 e2e row (3 at a time in the browser) waits for the UI in slice 5.
Review: round 3, confidence 89/100, no open Critical/Major.

## Slice 4/6 (4a: T7 part 1, 4b: T7 part 2 + T10), 2026-11-09

| Check | Command | Result |
| :-- | :-- | :-- |
| test | `npm test` | 72 passed, 0 failed (all locked tests now pass) |
| typecheck / lint | `npx tsc --noEmit`, `npx eslint src` | pass (also with 4a alone) |

Traceability: R7 "R7 invalid roles are dropped"; R8 "R8 type is consultation_recording and summary has five sections", "R8 follow-up is recording date plus days", "R8 observation needs a test name and a number"; R9 "R9 person suggested unless confidence is low". All pass. Orphan tests: none.

Mutation check: empty-section, digit-filter and confidence mutants all turn tests red; file restored.

Not verified: real-model quality (speaker roles, summary, follow-up from "2 tuần sau"), the R8/R9/R13 e2e rows. They need the review UI (slice 5) and the OpenAI key, which Claude can't load.
Review: round 4, confidence 85/100; Majors fixed (numeric part times, slice size).

## Slice 5/6 (T8), 2026-11-09

| Check | Command | Result |
| :-- | :-- | :-- |
| test | `npm test` | 87 passed, 0 failed |
| typecheck / lint | `npx tsc --noEmit`, `npx eslint src` | pass |
| browser, full run | local Supabase, flag on, the real OpenAI models, the owner's 1:54 m4a through "+" | pass after 3 fixes (review round 5) |

Traceability (e2e, browser): R5 progress "Đang chép lời 0/1"; R6 a failed part shows "Chép lời lỗi 1/1 phần", and "Thử lại" re-sent only that part, then the AI read ran (~12 s); R8 the review shows the five summary sections; R10 recording date, player, transcript toggle, nothing saved before Xác nhận; R15 the audio loads through a signed URL with a token.

Model comparison: on the owner's first recording (1:54), diarize kept 0:00–0:36 and the plain model drifted into Korean and Thai. On the second recording (5:12, dermatology), diarize gave a correct Bác sĩ / Bệnh nhân transcript and 4 sensible to-dos for 0:00–1:11; a clip of 1:10–4:10 alone gave 0 segments (no speech there). `gpt-4o-transcribe` and `whisper-1` both hallucinated. Default stays diarize.

Not verified: confirming a recording and the visit-page view (slice 6); 12 parts running 3 at a time (needs a recording of nearly 2 hours); iPhone.
