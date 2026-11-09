# Review round 1 - audio-recordings (slice 1/6)
Reviewer: Opus, inline (priority medium, 1 round). Diff: main (95db05d)..working tree, 5 files (migration, rollback, `database.types.ts`, `audio-plan.ts`, `audio-plan.test.ts`), ~330 lines (tests at half weight).

| Step | Finding |
| --- | --- |
| Correctness | Migration is additive; `search_records` differs from the current body by exactly 2 lines; boundaries 599/600/601/7200/7201 s correct. 2 Minor (below). |
| Tests | 11 locked tests unchanged and passing; all go red when the code is broken. SQL checks pass on local Supabase. |
| Readability | Matches neighbouring files; comments explain why. |
| Security | New table has RLS "members only" like `inbox_files`; search stays `SECURITY INVOKER`; no secrets or real data. |
| Scope | Only the 5 slice files; within budget (5 files / ~330 lines). Later-slice stubs and tests are excluded from this MR. |
| Rollback | Down SQL in `supabase/rollbacks/` (outside `migrations/`), verified locally; keeps recordings as `other`. 1 Minor. |
| Plan compliance | T1 and T2 as planned. Plan updated for the rollback path. |

## Comments
1. `src/lib/audio-plan.ts:planParts` - **Minor** - R4
   Problem: with `quietAt`, a cut may move up to +10 s, so a part can be 610 s long, while R4 says "at most 10 minutes"; `planParts` also accepts `NaN`/≤0 and returns a bogus part.
   Failure scenario: a quiet point at 609.5 s gives part 1 = 609.5 s, so a strict ≤ 600 s check (if added later) would fail. `planParts(NaN)` → `[{start: 0, end: NaN}]` if a caller skips `checkDuration`.
   Fix: in T3, change R4's wording to "about 10 minutes (≤ 610 s)" and make `planParts` throw `AUDIO_FORMAT_ERROR` for non-finite or ≤ 0 durations (with a new failing test first).
2. `supabase/rollbacks/20261109010000_audio_recordings.down.sql:6-8` - **Minor** - R14
   Problem: the rollback drops both `transcript` columns. Transcripts saved after go-live would be lost, and the file doesn't warn about it.
   Failure scenario: rolling back a month after launch silently deletes every confirmed transcript.
   Fix: add a header comment telling whoever runs it to export `documents.transcript` first (`copy (select id, transcript from public.documents where transcript is not null) to …`).
3. `supabase/migrations/20261109010000_audio_recordings.sql:50` - **Nit**
   Searching full transcripts (up to ~100k characters for 2 h) normalises that text on every query. Fine at family scale; revisit if search slows.

## Confidence: 91/100
Correctness 27/30 - additive migration, minimal search diff, one loose input guard; Tests 23/25 - all boundaries covered and mutation-checked, SQL checked only locally; Security 18/20 - RLS in place, but whether the public pages expose recordings is open (other feature); Plan compliance 14/15 - rollback path changed with plan updated; Readability 9/10 - clear.
Checks: `npx tsx --test src/lib/audio-plan.test.ts` 11/11 pass, `npx tsc --noEmit` pass, `npx eslint src` pass. Not verified: the migration on the hosted project (not applied), the bucket-privacy row (T8).
