# Review round 2 - audio-recordings (slice 2/6, split into 2a and 2b)
Reviewer: Opus, inline (priority medium). Diff: slice 1 branch..working tree, 13 code files, ~507 weighted lines.

| Step | Finding |
| --- | --- |
| Correctness | Browser test (local Supabase, flag on) found T3 ignoring mono/48 kbps for a 22.05 kHz source (stereo 111 kbps): mediabunny silently fell back to 2 ch/48 kHz because mono at the source rate isn't encodable. Fixed with an explicit 48 kHz output; re-test gives mono 48 kHz ~48.6 kbps. User's 1:54 recording: 950 KB → 722 KB mono, 1 part, `recorded_on` saved. 18-min file: 2 parts, cut at 603.0 s (in a silence). |
| Tests | 13/13 audio-plan tests; new guard test killed by mutation. T3/T4 have no unit-testable surface beyond that (WebCodecs, components); covered by the browser run. |
| Readability | Follows the existing upload pattern; flag-off path passes the original arrays unchanged. |
| Security | Parts paths come from the client like file paths today (members-only RLS, zod-validated, max 12 parts). No secrets. |
| Scope | Over the review budget (13 files / ~507 lines > 10 / 400): **Major**, fixed by splitting into 2a (T3) and 2b (T4). `recording_date` migration added with the user's decision (R9). |
| Rollback | Down SQL for `recording_date`; flag `NEXT_PUBLIC_AUDIO_UPLOADS` off hides T4. |
| Plan compliance | Plan updated: T3/T4 file lists, slices 2a/2b. |

## Comments
1. Slice size - **Major** - fixed by splitting into 2a and 2b.
2. `src/lib/audio.ts:transcode` - **Major** (R3) - fixed: output forced to 48 kHz mono; verified in the browser.
3. `src/components/QuickAddButton.tsx`, `AssistantChat.tsx` - **Minor** - if a later file fails after a recording was saved, a retry reports that recording as a duplicate (QuickAdd) or leaves an inbox item with no chat message (chat). Fix in T8 or T11 (drop saved files from the pick, as `DocumentUploader` does).
4. Inbox review of an audio item (flag on) - **Minor** - "Thử lại" runs the photo reader, which fails with the PDF/JPG message until T7 routes audio. Behind the flag; T7 fixes it.
5. `src/lib/audio.ts` - **Nit** - short parts measure ~53 kbps because container overhead weighs more on a short file; the encoder target is 48 kbps.

## Confidence: 88/100
Correctness 26/30 - one real bug found and fixed in the browser, two Minors left behind the flag; Tests 21/25 - browser-verified, little unit surface; Security 18/20 - same trust model as file paths; Plan compliance 14/15 - split recorded; Readability 9/10.
Checks: `npx tsc --noEmit` pass, `npx eslint src` pass, `npm test` 72 tests (58 pass, 14 later-slice "not implemented"). Not verified: iPhone Safari (needs the user's phone), flag-off in the browser (verified by code: same arrays and the same accept string).
