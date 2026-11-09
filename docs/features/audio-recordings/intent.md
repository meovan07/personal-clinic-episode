# Intent: Upload a consultation recording and get a transcript and summary

Author: Hung (with Claude). Status: approved. Approved: 2026-11-09.

## Goal

A member uploads a doctor-consultation recording of up to 2 hours (m4a, mp3, wav, webm) and gets a speaker-labelled transcript, a structured summary and the usual to-dos, medications and follow-up on the review screen, ready to confirm into a visit.

Done when: the user's real consultation m4a, uploaded through "+", reaches the review screen with a transcript, a sectioned summary (Lý do khám, Bác sĩ nói gì, Chẩn đoán, Dặn dò, Thuốc) and the doctor's advice as to-dos; after **Xác nhận**, the visit page plays the audio and shows the summary, and searching for a word spoken in the recording finds that visit.

## Problem

What the doctor says during a visit (diagnosis, how to take the medicine, when to come back) often isn't written on any paper, so it never reaches the records. Members can record the consultation on their phone, but the app only accepts photos and PDFs, so the recording sits in the phone's voice memos and can't be searched.

## Proposed outcome

Recordings go in the same way photos do. The AI transcribes the recording, writes a structured summary, pulls out advice, medications and the follow-up date, and the member checks it on the review screen before anything is saved. The recording can be replayed later, and search and the assistant can use what was said.

## Affected users and systems

- Both members (same row-level security as documents).
- Upload pipeline (`src/lib/upload.ts`, `DocumentUploader`, `QuickAddButton`, chat attachments).
- AI: new transcription step, a consultation mode for extraction (`src/lib/ai/extract.ts`), person/visit matching for the inbox.
- Data: `documents`, `document_files`, `inbox_items`, `search_records`, assistant tools.
- Review screens, visit page.
- OpenAI transcription API.

## Constraints

- OpenAI's limit is 25 MB per transcription request, so long audio is split in the browser (no ffmpeg on the server).
- Each server function runs for at most 300 s, so transcription runs one part per request.
- Supabase free plan: 1 GB of storage, so the audio is compressed in the browser before upload.
- Recordings longer than 2 hours are rejected.
- Medical data: OpenAI calls use `store: false`, files sit in the private bucket, and nothing is saved until the member confirms on the review screen.
- Out of scope: recording inside the app, editing the transcript.

## Open questions

- Which transcription model, and does it label speakers well in Vietnamese? To be decided by testing on the user's file.
- Where to split: overlap the parts by a few seconds, or cut at silences?
- Where transcription runs: in the browser, one server request per part, or in a background job?
