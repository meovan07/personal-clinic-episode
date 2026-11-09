# Delivery: Upload a consultation recording and get a transcript and summary

Plan: plan.md. Merge request: slice 1/6 (link below). Status: in review.

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
