// Client only: audio processing in the browser with WebCodecs via mediabunny.
// Pure planning (format/length checks, part plan, quiet-point pick) is in ./audio-plan.ts.
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeAudio,
} from "mediabunny";
import {
  AUDIO_FORMAT_ERROR,
  CUT_WINDOW_SEC,
  MAX_PART_BYTES,
  PART_SEC,
  QUIET_STEP_SEC,
  checkAudioFile,
  checkDuration,
  pickQuietPoint,
  planParts,
} from "./audio-plan";

export const AUDIO_UNSUPPORTED_ERROR = "Trình duyệt này chưa hỗ trợ ghi âm, hãy dùng Safari hoặc Chrome mới.";

export const AUDIO_PART_TOO_LARGE_ERROR = "Phần ghi âm quá lớn, hãy cắt bớt bản ghi.";

const BITRATE = 48_000;
// Fixed output rate: if the encoder rejects the source rate, mediabunny silently falls back to stereo 48 kHz.
const SAMPLE_RATE = 48_000;

type StoredFormat = { codec: "aac" | "opus"; ext: string; mime: string };

export function supportsAudioProcessing(): boolean {
  return "AudioDecoder" in globalThis && "AudioEncoder" in globalThis;
}

function openInput(file: File): Input {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
}

/** AAC in MP4 when the browser can encode it, else Opus in WebM. */
async function pickFormat(): Promise<StoredFormat> {
  const opts = { numberOfChannels: 1, sampleRate: SAMPLE_RATE, bitrate: BITRATE };
  if (await canEncodeAudio("aac", opts)) return { codec: "aac", ext: "m4a", mime: "audio/mp4" };
  if (await canEncodeAudio("opus", opts)) return { codec: "opus", ext: "webm", mime: "audio/webm" };
  throw new Error(AUDIO_UNSUPPORTED_ERROR);
}

/** Duration in seconds, or null when the file cannot be read. Never throws. */
export async function readDuration(file: File): Promise<number | null> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    const sec = await input.computeDuration([track]);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}

/** Mono, 48 kbps re-encode, optionally of [startSec, endSec] only. Streams packet by packet (no full decode in memory). */
async function transcode(file: File, name: string, range?: { start: number; end: number }): Promise<File> {
  const fmt = await pickFormat();
  const input = openInput(file);
  try {
    const target = new BufferTarget();
    const output = new Output({
      format: fmt.codec === "aac" ? new Mp4OutputFormat() : new WebMOutputFormat(),
      target,
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: {
        codec: fmt.codec,
        numberOfChannels: 1,
        sampleRate: SAMPLE_RATE,
        quality: new Quality({ bitrate: BITRATE }),
        forceTranscode: true,
      },
      trim: range,
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error(AUDIO_FORMAT_ERROR);
    await conversion.execute();
    if (!target.buffer) throw new Error(AUDIO_FORMAT_ERROR);
    return new File([target.buffer], `${name}.${fmt.ext}`, { type: fmt.mime });
  } finally {
    input.dispose();
  }
}

export function compressForStorage(file: File, name: string): Promise<File> {
  return transcode(file, name);
}

/** Quietest 0.5 s block within ±10 s of markSec; markSec itself on any decode issue. */
export async function findQuietPoint(file: File, markSec: number): Promise<number> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return markSec;
    const origin = Math.max(0, markSec - CUT_WINDOW_SEC);
    const end = markSec + CUT_WINDOW_SEC;
    const blocks = Math.ceil((end - origin) / QUIET_STEP_SEC);
    const sumSq = new Array<number>(blocks).fill(0);
    const count = new Array<number>(blocks).fill(0);
    const sink = new AudioBufferSink(track);
    for await (const { buffer, timestamp } of sink.buffers(origin, end)) {
      const channels = buffer.numberOfChannels;
      const data: Float32Array[] = [];
      for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
      for (let i = 0; i < buffer.length; i++) {
        const b = Math.floor((timestamp + i / buffer.sampleRate - origin) / QUIET_STEP_SEC);
        if (b < 0 || b >= blocks) continue;
        let mono = 0;
        for (let c = 0; c < channels; c++) mono += data[c][i];
        mono /= channels;
        sumSq[b] += mono * mono;
        count[b] += 1;
      }
    }
    // Blocks with no samples count as loudest so they are never chosen.
    const loudness = sumSq.map((s, b) => (count[b] > 0 ? Math.sqrt(s / count[b]) : Number.POSITIVE_INFINITY));
    return pickQuietPoint(loudness, origin, markSec);
  } catch {
    return markSec;
  } finally {
    input.dispose();
  }
}

export async function encodePart(file: File, startSec: number, endSec: number, name: string): Promise<File> {
  const part = await transcode(file, name, { start: startSec, end: endSec });
  if (part.size > MAX_PART_BYTES) throw new Error(AUDIO_PART_TOO_LARGE_ERROR);
  return part;
}

export async function prepareRecording(
  file: File,
  baseName: string,
  onProgress?: (step: string) => void,
): Promise<{
  recording: File;
  parts: { part_no: number; start: number; end: number; file: File }[];
  durationSec: number;
}> {
  if (!supportsAudioProcessing()) throw new Error(AUDIO_UNSUPPORTED_ERROR);
  const formatError = checkAudioFile(file);
  if (formatError) throw new Error(formatError);
  const durationSec = await readDuration(file);
  const durationError = checkDuration(durationSec);
  if (durationError || durationSec === null) throw new Error(durationError ?? "");

  onProgress?.("Đang nén bản ghi");
  const recording = await compressForStorage(file, baseName);

  onProgress?.("Đang tìm điểm cắt");
  const cuts = new Map<number, number>();
  for (let mark = PART_SEC; mark < durationSec; mark += PART_SEC) {
    cuts.set(mark, await findQuietPoint(recording, mark));
  }
  const planned = planParts(durationSec, { bitrateKbps: BITRATE / 1000, quietAt: (m) => cuts.get(m) ?? m });

  const parts: { part_no: number; start: number; end: number; file: File }[] = [];
  for (const p of planned) {
    onProgress?.(`Đang tạo phần ${p.part_no}/${planned.length}`);
    const partFile = await encodePart(recording, p.start, p.end, `${baseName}-phan-${p.part_no}`);
    parts.push({ ...p, file: partFile });
  }
  return { recording, parts, durationSec };
}
