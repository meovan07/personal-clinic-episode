// Server only: one audio part → diarized segments. Spec R5. The transcription endpoint has no `store` option.
import type OpenAI from "openai";
import { toFile } from "openai/uploads";
import type { Segment } from "@/lib/transcript";

export const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-transcribe-diarize";

export type AudioPart = { name: string; mime: string; bytes: Buffer };

export async function transcribePartAudio(
  part: AudioPart,
  { client, model = process.env.TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL }: { client: Pick<OpenAI, "audio">; model?: string },
): Promise<Segment[]> {
  const res = (await client.audio.transcriptions.create({
    file: await toFile(part.bytes, part.name, { type: part.mime }),
    model,
    language: "vi",
    response_format: model.includes("diarize") ? "diarized_json" : "json",
    chunking_strategy: "auto",
  })) as { text?: string; segments?: { start: number; end: number; speaker: string; text: string }[] };
  const segments = res.segments ?? [];
  if (segments.length) {
    return segments.map((s) => ({ start: s.start, end: s.end, speaker: s.speaker, text: s.text }));
  }
  // Plain models (gpt-4o-transcribe) return only text.
  return res.text?.trim() ? [{ start: 0, end: 0, speaker: "A", text: res.text }] : [];
}
