import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribePartAudio } from "./transcribe";

test("R5 transcription request uses diarize defaults and override", async () => {
  const captured: Record<string, unknown>[] = [];
  const client = {
    audio: {
      transcriptions: {
        create: async (p: Record<string, unknown>) => {
          captured.push(p);
          return { segments: [] };
        },
      },
    },
  } as never;
  const part = { name: "1.m4a", mime: "audio/mp4", bytes: Buffer.from("fake") };
  const saved = process.env.TRANSCRIBE_MODEL;
  try {
    delete process.env.TRANSCRIBE_MODEL;
    await transcribePartAudio(part, { client });
    await transcribePartAudio(part, { client, model: "gpt-4o-transcribe" });
  } finally {
    if (saved === undefined) delete process.env.TRANSCRIBE_MODEL;
    else process.env.TRANSCRIBE_MODEL = saved;
  }
  assert.equal(captured.length, 2);
  assert.equal(captured[0].model, "gpt-4o-transcribe-diarize");
  assert.equal(captured[1].model, "gpt-4o-transcribe");
  for (const c of captured) {
    assert.equal(c.response_format, "diarized_json");
    assert.equal(c.chunking_strategy, "auto");
    assert.equal(c.language, "vi");
  }
});
