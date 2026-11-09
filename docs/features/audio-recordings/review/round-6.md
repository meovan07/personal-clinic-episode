# Review round 6 - audio-recordings (slice 6a/6)
Reviewer: Opus, inline (priority medium). Diff: slice 5..working tree, 7 files, ~372 weighted lines.

| Step | Finding |
| --- | --- |
| Correctness | Browser run (local Supabase, flag on, the real models, the owner's 5:12 dermatology recording attached on a visit): the card shows the date and player, then "Đọc bằng AI" shows "Đang chép lời 0/1", then the document review opens. After confirm: `confirmed`, 4 to-dos, 0 `transcript_parts` rows, 0 part files, the recording kept (R14). The visit page shows the card, player and summary (R11). Search finds the recording by spoken words and by "ghi âm" (R12). |
| Tests | 87/87; cleanup reuses the tested `partPathsToDelete`. UI checked in the browser. |
| Readability | `RecordingCard` and `RecordingReadButton` mirror the existing `AiReadButton` / `InboxRetry` patterns. |
| Security | Cleanup goes through the member's client (RLS). Public viewers get the player and summary only (owner's decision); no transcript. |
| Scope | 7 files: within budget. |
| Rollback | Revert; behind the flag. |
| Plan compliance | Slice 6 split into 6a (T9) and 6b (T11). |

## Comments
1. `src/lib/services/records.ts` - **Minor** (open) - `deleteVisit` and `deletePerson` don't remove part files of recordings that were never confirmed (rows cascade, files stay in storage). Small storage leak; fix with T11 or later.
2. `src/components/DocumentUploader.tsx` - **Minor** (open, T11) - the hint still says "Tải tài liệu lên (ảnh, PDF)"; with the flag on it should mention recordings.
3. `src/components/RecordingCard.tsx` - **Nit** - the summary's `###` headings render no bigger than body text in the card; consider the health summary's heading style.
4. Behaviour - the diarize model's output varies between runs on the same audio (different wording for 0:00–1:11 each time). Expected for speech models; the review screen is where the user corrects it.

## Confidence: 88/100
Correctness 27/30; Tests 21/25 - UI covered by the browser run only; Security 18/20 - small storage leak; Plan compliance 14/15; Readability 8/10.

## Slice 6b follow-up (same day)
- Minor 1 fixed: `deleteVisit` and `deletePerson` remove the part files too. Browser check: deleting a visit with an unread 18-min recording left 0 rows and 0 files.
- Minor 2 fixed: upload texts mention recordings ("Tải ảnh / PDF / ghi âm buổi khám", "(ảnh, PDF, ghi âm)").
- Nit 3 fixed: `###` → `##` before the health summary renderer, so the sections look like headings.
- Round 2 Minor 3 fixed: "+" and the chat drop already-saved files from the pick, so a retry doesn't report them as duplicates; the chat still sends the message for items saved before a failure.
- Flag on by default (`NEXT_PUBLIC_AUDIO_UPLOADS=0` turns it off), checked with the variable unset.
