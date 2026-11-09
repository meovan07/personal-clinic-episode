# Review round 5 - audio-recordings (slice 5/6)
Reviewer: Opus, inline (priority medium). Diff: slice 4b..working tree, 10 files, ~220 weighted lines.

| Step | Finding |
| --- | --- |
| Correctness | First full run (local Supabase, real OpenAI, the owner's 1:54 m4a): upload, then "Đang chép lời 0/1", then transcribed, then the AI read, then the review screen with the date, player, transcript and five-section summary. The run found 3 bugs, all fixed (below). |
| Tests | 87/87. The R5 locked test was changed with the owner's approval (the plain model must get `json`). UI is verified in the browser, not by unit tests. |
| Readability | Small components; InboxRetry uses refs so the AI read runs exactly once. |
| Security | Audio is shown through 1-hour signed URLs (R15); the transcript is read-only. |
| Scope | 10 files: within budget. `labels.ts` and `transcribe.ts` were added to T8 in the plan. |
| Rollback | Revert; behind the flag. |
| Plan compliance | T8 done; the spec now records the public-page decision. |

## Comments
1. `src/components/InboxRetry.tsx` - **Major** (fixed) - when every part was done but the AI read hadn't run, the page waited for "Thử lại" instead of reading. Now it reads automatically, exactly once, unless the item already has an error.
2. `src/lib/ai/transcribe.ts` - **Major** (fixed) - `TRANSCRIBE_MODEL=gpt-4o-transcribe` failed with 400 because only the diarize model accepts `diarized_json`. The response format now depends on the model.
3. `src/lib/labels.ts` - **Major** (fixed) - "Loại tài liệu" had no recording option, so a recording defaulted to "Kết quả xét nghiệm".
4. `src/components/Transcript.tsx` - **Minor** (fixed) - a single segment without times showed "(0 phút)"; the label now drops the minutes.
5. Transcription quality - **resolved, recording-dependent**. Second recording from the owner (5:12, dermatology visit):

   | Model | Result |
   | :-- | :-- |
   | `gpt-4o-transcribe-diarize` (default) | Vietnamese, Bác sĩ / Bệnh nhân correct, 4 sensible to-dos (how to apply the cream), up to 1:11 |
   | `gpt-4o-transcribe` | the same part, then Indonesian, Korean and made-up lines |
   | `whisper-1` | only a repeated "đăng ký kênh" hallucination |

   A clip of 1:10–4:10 on its own gave **0 segments** with the diarize model, so that stretch has no recognisable speech (background sound). The model isn't dropping speech. Default stays `gpt-4o-transcribe-diarize`.
6. `src/lib/ai/transcribe.ts` - **Minor** (fixed) - `whisper-1` returned 400 "chunking_strategy is not supported"; `chunking_strategy` is now sent only to `gpt-*` models.
7. Recording with no speech - **Minor** (open, T11) - the AI read runs on an empty transcript, and the review shows every section as "Không nhắc đến." plus an uncertainty note. Nothing is made up, but a clear "Không nghe được lời nói nào trong bản ghi" would be better.

## Confidence: 84/100
Correctness 25/30 - flow verified end to end, quality open; Tests 21/25; Security 19/20; Plan compliance 12/15 - two files added during the run; Readability 7/10.
