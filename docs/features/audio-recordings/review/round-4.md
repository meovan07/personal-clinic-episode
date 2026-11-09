# Review round 4 - audio-recordings (slice 4/6, split into 4a and 4b)
Reviewer: Opus, inline (priority medium). Diff: slice 3..working tree, 7 code files, ~456 weighted lines.

| Step | Finding |
| --- | --- |
| Correctness | Consultation prompt and post-processing match R8: forced type, five sections, observations only with a name and a number, follow-up computed in code from `follow_up_in_days`. Recordings go through the same visit-guess code as photos; the person suggestion needs "high" confidence (R9). `saveInboxItem` re-points parts to the new document before the inbox row is deleted. 1 Major fixed. |
| Tests | 5 locked consultation tests pass; mutants (empty section, digit filter, confidence) turn tests red; `npm test` 72/72. |
| Readability | Roster builder factored out (no behaviour change); photo prompt untouched. |
| Security | Every call `store: false`; RLS client throughout; `read_transcript` reads through RLS. |
| Scope | Over budget (456 > 400): **Major**, fixed by splitting into 4a and 4b. |
| Rollback | Revert; behind the flag. |
| Plan compliance | `finishTranscript` became `readRecording`, which `readInboxItem` / `readDocumentWithAI` call (plan step 5 allowed this routing). `consultation_recording` added to `DOC_TYPES` so review and confirm accept it; the photo prompt is unchanged. |

## Comments
1. `src/lib/services/inbox.ts:readRecording` - **Major** (fixed) - part start/end come from Postgres `numeric`; if they arrive as strings, `joinParts` would concatenate instead of adding. Now converted with `Number()`, as `loadTranscriptParts` does.
2. Slice size - **Major** (fixed) - split into 4a and 4b.
3. `src/lib/ai/extract.ts:DOC_TYPES` - **Minor** - the photo reader's enum now also offers `consultation_recording`. Unlikely for a photo, and the review screen lets the user change it.
4. `src/lib/agent/tools.ts:get_visit` - **Nit** (fixed) - it loaded whole transcripts to compute `has_transcript`; now selects only the first segment.

## Confidence: 85/100
Correctness 26/30; Tests 20/25 - model quality (roles, summary, follow-up) is not verified with real audio yet: the `.env` guard blocks Claude from loading the key, and it's covered by slice 5's browser run; Security 19/20; Plan compliance 13/15; Readability 7/10.
