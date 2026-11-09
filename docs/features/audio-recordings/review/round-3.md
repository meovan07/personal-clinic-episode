# Review round 3 - audio-recordings (slice 3/6)
Reviewer: Opus, inline (priority medium). Diff: slice 2b..working tree, 6 code files, ~317 weighted lines.

| Step | Finding |
| --- | --- |
| Correctness | Helpers match the spec values; the scheduler never exceeds 3 and skips running/done parts; retry re-runs failed parts only; OpenAI and download failures are recorded on the part, not thrown. 1 Minor. |
| Tests | 9 locked tests pass (8 transcript, 1 transcribe); mutants (offset, concurrency, rounding, language) all turn tests red. |
| Readability | Small hook with refs for in-flight state; actions follow the file's `check()` / zod style. |
| Security | Parts loaded through the member's RLS client; part id validated as a uuid; the OpenAI key stays server-side; no `store` option exists on this endpoint (R15 note). |
| Scope | 6 files, ~317 lines: within budget. Not wired to any page yet (T8). |
| Rollback | Revert; nothing user-visible. |
| Plan compliance | T5, T6 as planned; `TranscriptPartRow` (part + id) added in `actions.ts` because the scheduler needs row ids. |

## Comments
1. `src/lib/transcript.ts:joinParts` - **Minor** - R6: an empty part list counts as `complete`. `finishTranscript` (T7) must treat 0 parts as an error, not as an empty transcript.
2. `src/app/actions.ts:transcribePart` - **Minor** (fixed) - the OpenAI error was swallowed; now logged server-side with the part id.
3. `src/app/actions.ts` - **Nit** (fixed) - the new code used the deprecated `z.string().uuid()`; switched to `z.uuid()`.

## Confidence: 89/100
Correctness 27/30; Tests 22/25 - the real-model run is not verified yet (the `.env` guard blocks Claude from loading the key; the owner can run the probe, otherwise it's covered in slice 5); Security 19/20; Plan compliance 14/15; Readability 7/10 - the hook's ref juggling needs care.
Checks: `npx tsc --noEmit`, `npx eslint src` pass; `npm test` 72 tests (67 pass, 5 slice-4 "not implemented").
