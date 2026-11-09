import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  cleanSpokenObservations,
  followUpFrom,
  normalizeConsultationSummary,
  parseSpeakerRoles,
} from "@/lib/consultation";
import { formatTime, SPEAKER_ROLES, type Segment } from "@/lib/transcript";

// Only used on the server: OPENAI_API_KEY must never reach the browser.

export const DOC_TYPES = [
  "lab_result",
  "imaging_report",
  "prescription",
  "discharge_summary",
  "visit_note",
  "vaccination_record",
  "invoice",
  "consultation_recording",
  "other",
] as const;

export const Extraction = z.object({
  document_type: z.enum(DOC_TYPES),
  facility: z.string().nullable().describe("Hospital, clinic or lab name as printed"),
  department: z.string().nullable(),
  doctor: z.string().nullable(),
  document_date: z.string().nullable().describe("Date of the result/visit, YYYY-MM-DD"),
  summary: z.string().describe("2-4 sentences in Vietnamese: what this document shows, highlighting abnormal findings"),
  diagnoses: z.array(z.string()).describe("Diagnoses/conclusions exactly as written (Vietnamese), include ICD-10 code if printed"),
  doctor_advice: z
    .array(z.string())
    .describe("Concrete instructions for the patient, in Vietnamese, one per item. Put the re-examination date in follow_up_date, not here"),
  follow_up_date: z
    .string()
    .nullable()
    .describe("Re-examination date, YYYY-MM-DD. If relative ('tái khám sau 2 tuần'), compute it from document_date"),
  medications: z.array(
    z.object({
      name: z.string().describe("Drug name with strength, e.g. 'Omeprazole 20mg'"),
      dose: z.string().nullable().describe("Amount per intake, e.g. '1 viên'"),
      schedule: z.string().nullable().describe("When/how often, in Vietnamese, e.g. 'Sáng 1, tối 1, sau ăn'"),
      duration_days: z.number().int().nullable(),
      notes: z.string().nullable(),
    }),
  ),
  observations: z.array(
    z.object({
      raw_name: z.string().describe("Test name exactly as printed"),
      test_code: z.string().nullable().describe("Best matching code from the catalog, or null if none fits"),
      value: z.string().describe("Result as printed but WITHOUT flag markers like H/L/*/↑, e.g. '5,8', '126', 'Âm tính', '<0.5'"),
      unit: z.string().nullable().describe("Unit exactly as printed"),
      ref_range: z.string().nullable().describe("Reference range exactly as printed"),
      flag: z.enum(["normal", "high", "low", "abnormal"]).nullable().describe("As marked on the paper (H/L/*/bold), else your judgment against ref_range"),
    }),
  ),
  vaccinations: z.array(
    z.object({
      vaccine_name: z.string().describe("Vaccine/product name exactly as printed, e.g. 'Vaxigrip Tetra', 'Gardasil 9', 'Viêm gan B'"),
      disease: z
        .string()
        .nullable()
        .describe("What it protects against, short Vietnamese, e.g. 'Cúm', 'HPV', 'Viêm gan B', 'Uốn ván'"),
      dose_label: z.string().nullable().describe("Dose as printed, e.g. 'Mũi 1', 'Mũi 2', 'Nhắc lại'"),
      given_on: z.string().nullable().describe("Date the dose was given, YYYY-MM-DD"),
      next_due_on: z.string().nullable().describe("Next dose date if written (hẹn tiêm mũi tiếp), YYYY-MM-DD"),
      lot_number: z.string().nullable().describe("Lot/batch number (số lô) as printed"),
      facility: z.string().nullable().describe("Where it was given, if written per row"),
      typically_single_dose: z
        .boolean()
        .nullable()
        .describe(
          "Your general medical knowledge of this vaccine's standard schedule, NOT specific to this patient: true if it is normally given as a single dose " +
            "(e.g. most travel vaccines, single-antigen boosters like uốn ván for an already-immune adult), false if it normally requires multiple doses or " +
            "periodic boosters (e.g. viêm gan B primary series, HPV, DPT/DTaP, cúm yearly), null if genuinely unsure or it depends heavily on age/indication.",
        ),
    }),
  ),
  uncertain: z.array(z.string()).describe("Vietnamese notes about anything hard to read or ambiguous"),
});

export type ExtractionResult = z.infer<typeof Extraction>;

// Extractions saved before a field existed lack it; fill the gaps so they still parse on the review screens.
export function withExtractionDefaults(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const withDefaults: Record<string, unknown> = { vaccinations: [], ...json };
  if (Array.isArray(withDefaults.vaccinations)) {
    withDefaults.vaccinations = withDefaults.vaccinations.map((v) =>
      v && typeof v === "object" ? { typically_single_dose: null, ...v } : v,
    );
  }
  return withDefaults;
}

export type ExtractFile = { name: string; mime: string; bytes: Buffer };

const INSTRUCTIONS = `You read Vietnamese medical documents (lab results, imaging reports, prescriptions, discharge papers, visit notes, vaccination certificates / sổ tiêm chủng) photographed or scanned by the patient, and extract them into structured data.

Rules:
- The files are pages of ONE document, in order.
- Copy names, values, units and reference ranges exactly as printed. Never convert units or fix numbers; the app does that.
- Every measured value becomes one observation, including vital signs (weight, blood pressure, pulse) written on visit notes. Blood pressure "120/80" becomes two observations (BP_SYS, BP_DIA).
- For test_code, only use a code from the catalog below; if nothing matches, use null.
- If something is unreadable, leave it out or null and mention it in "uncertain". Never guess numbers.
- doctor_advice is only what a doctor told THIS patient to do (lifestyle, diet, medication use, re-examination). Printed boilerplate that appears on every sheet (e.g. "Kết quả chỉ có giá trị trên mẫu xét nghiệm", "Mẫu được lưu 24 giờ", "gặp bác sĩ nếu kết quả bất thường") is NOT advice; leave it out.
- Vaccination certificates, vaccination cards (sổ/phiếu tiêm chủng) and injection receipts: document_type is "vaccination_record", and every dose given becomes one entry in vaccinations (one row per dose, not per vaccine). Put the next-dose appointment in that dose's next_due_on, not in follow_up_date or doctor_advice. Leave vaccinations empty for other documents. typically_single_dose is general knowledge about the vaccine itself (not a prediction for this specific patient) - use it to flag vaccines that normally don't need a follow-up dose, but leave it null rather than guess.
- Write summary, doctor_advice and uncertain in Vietnamese.
- This is for the patient's personal records, not diagnosis. Do not add medical advice that is not written on the document.`;

function toContent(file: ExtractFile): ResponseInputContent | null {
  const base64 = file.bytes.toString("base64");
  if (file.mime === "application/pdf") {
    return { type: "input_file", filename: file.name, file_data: `data:application/pdf;base64,${base64}` };
  }
  if (/^image\/(jpeg|png|gif|webp)$/.test(file.mime)) {
    return { type: "input_image", image_url: `data:${file.mime};base64,${base64}`, detail: "high" };
  }
  return null; // e.g. HEIC, which the API does not accept
}

function buildContent(files: ExtractFile[]): { content: ResponseInputContent[]; skipped: string[] } {
  const content: ResponseInputContent[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const c = toContent(f);
    if (c) content.push(c);
    else skipped.push(f.name);
  }
  if (content.length === 0) {
    throw new Error("Không có file nào đọc được (chỉ hỗ trợ PDF, JPG, PNG, WEBP).");
  }
  return { content, skipped };
}

// Model for reading documents; separate from the chat model (CHAT_MODEL) because the trade-offs differ.
export const EXTRACTION_MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

export async function extractDocument(
  files: ExtractFile[],
  catalog: { code: string; name_vi: string }[],
  { model = EXTRACTION_MODEL }: { model?: string } = {},
): Promise<{ result: ExtractionResult; skipped: string[]; usage: OpenAI.Responses.ResponseUsage | undefined }> {
  const { content, skipped } = buildContent(files);
  const catalogText = catalog.map((c) => `${c.code}: ${c.name_vi}`).join("\n");
  const client = new OpenAI();
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    store: false, // don't keep medical documents on OpenAI's side
    instructions: `${INSTRUCTIONS}\n\nTest catalog:\n${catalogText}`,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: `Extract this document (${content.length} page(s)).` }, ...content],
      },
    ],
    text: { format: zodTextFormat(Extraction, "medical_document") },
  });

  if (!response.output_parsed) {
    throw new Error("AI không trả về kết quả hợp lệ. Thử lại sau.");
  }
  return { result: response.output_parsed, skipped, usage: response.usage };
}

// ---------- Inbox: extraction + person/bệnh án matching in one pass ----------

export const InboxExtraction = Extraction.extend({
  patient_name: z.string().nullable().describe("Patient's name as printed on the document, if legible"),
  matched_person_id: z.string().nullable().describe("Best-guess id from the family roster below. Prefer a guess over null; use person_match_confidence for doubt"),
  person_match_confidence: z.enum(["high", "low"]).nullable(),
  matched_case_id: z
    .string()
    .nullable()
    .describe("Id of an existing bệnh án of the matched person that this document clearly continues, else null"),
  is_new_case: z
    .boolean()
    .describe("True only if this document reflects a specific diagnosed condition or ongoing treatment worth tracking as its own bệnh án, and no existing case fits"),
  new_case_title: z.string().nullable().describe("Short Vietnamese bệnh án title, only meaningful when is_new_case is true"),
});

export type InboxExtractionResult = z.infer<typeof InboxExtraction>;

const MATCH_INSTRUCTIONS = `
You also decide which family member this document belongs to and whether it continues an existing bệnh án (case).

Rules:
- Read the patient name as printed (patient_name), but decide matched_person_id using ALL context (name, age/sex if shown, handwriting, facility patterns) against the roster below.
- The family is small. Always pick your best-guess matched_person_id from the roster ids given — do not return null just because the name isn't a perfect string match (nicknames, missing diacritics, a spouse's or child's name are common). Set person_match_confidence to "low" when you're genuinely unsure instead of leaving matched_person_id null.
- matched_case_id must be one of the listed case ids belonging to the matched person, and only when the diagnosis/illness in this document clearly continues that case (same condition/body area/ongoing treatment). Otherwise null.
- is_new_case is true only when the document is about a specific diagnosed condition or ongoing treatment worth tracking as its own bệnh án (not a routine annual checkup, a one-off vaccination, or a normal-result general screening), and no existing case already covers it. In that case also fill new_case_title with a short Vietnamese title in the same style as existing ones (e.g. "Viêm dạ dày", "Gãy tay trái").`;

function buildRoster(
  people: { id: string; full_name: string; birth_date: string | null; sex: string | null }[],
  casesByPerson: Record<string, { id: string; title: string; status: string; started_on: string | null }[]>,
): string {
  return people
    .map((p) => {
      const cases = casesByPerson[p.id] ?? [];
      const caseLines = cases.length
        ? cases
            .map((c) => `  - [id=${c.id}] "${c.title}" (${c.status}${c.started_on ? `, bắt đầu ${c.started_on}` : ""})`)
            .join("\n")
        : "  (chưa có bệnh án nào)";
      return `- [id=${p.id}] ${p.full_name}${p.birth_date ? ` (sinh ${p.birth_date})` : ""}${p.sex ? `, ${p.sex}` : ""}\n${caseLines}`;
    })
    .join("\n");
}

export async function extractAndMatchDocument(
  files: ExtractFile[],
  catalog: { code: string; name_vi: string }[],
  people: { id: string; full_name: string; birth_date: string | null; sex: string | null }[],
  casesByPerson: Record<string, { id: string; title: string; status: string; started_on: string | null }[]>,
): Promise<{ result: InboxExtractionResult; skipped: string[] }> {
  const { content, skipped } = buildContent(files);
  const catalogText = catalog.map((c) => `${c.code}: ${c.name_vi}`).join("\n");
  const rosterText = buildRoster(people, casesByPerson);

  const client = new OpenAI();
  const response = await client.responses.parse({
    model: EXTRACTION_MODEL,
    reasoning: { effort: "low" },
    store: false, // don't keep medical documents on OpenAI's side
    instructions: `${INSTRUCTIONS}\n${MATCH_INSTRUCTIONS}\n\nTest catalog:\n${catalogText}\n\nGia đình và bệnh án hiện có:\n${rosterText}`,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: `Extract this document (${content.length} page(s)).` }, ...content],
      },
    ],
    text: { format: zodTextFormat(InboxExtraction, "medical_document_matched") },
  });

  if (!response.output_parsed) {
    throw new Error("AI không trả về kết quả hợp lệ. Thử lại sau.");
  }
  return { result: response.output_parsed, skipped };
}


// ---------- Consultation recordings: speaker roles + extraction from a transcript ----------

const SpeakerRoles = z.object({
  parts: z.array(
    z.object({
      part_no: z.number().int(),
      speakers: z.array(z.object({ letter: z.string(), role: z.enum([...SPEAKER_ROLES, "unknown"]) })),
    }),
  ),
});

const SPEAKER_INSTRUCTIONS = `Đây là các phần của một buổi khám bệnh bằng tiếng Việt, đã được chép lời; người nói được gán chữ cái (A, B, C...). Chữ cái chỉ có nghĩa trong từng phần.
Với mỗi phần, quyết định mỗi chữ cái là: "Bác sĩ", "Bệnh nhân", "Người nhà" hoặc "Khác" (ví dụ y tá, lễ tân). Nếu không chắc, trả "unknown".
Bác sĩ thường hỏi triệu chứng, chẩn đoán, kê đơn, dặn dò; bệnh nhân kể triệu chứng và trả lời. Không viết lại hay sửa lời thoại.`;

const SAMPLE_UTTERANCES = 6;
const SAMPLE_CHARS = 300;

export async function assignSpeakers(
  parts: { part_no: number; segments: { speaker: string; text: string }[] }[],
  { client = new OpenAI() }: { client?: OpenAI } = {},
): Promise<Record<number, Record<string, string>>> {
  const text = parts
    .map((part) => {
      const byLetter = new Map<string, string[]>();
      for (const seg of part.segments) {
        const list = byLetter.get(seg.speaker) ?? [];
        if (list.length < SAMPLE_UTTERANCES) list.push(seg.text.slice(0, SAMPLE_CHARS));
        byLetter.set(seg.speaker, list);
      }
      const speakers = [...byLetter.entries()]
        .map(([letter, lines]) => `Người nói ${letter}:\n${lines.map((l) => `- ${l}`).join("\n")}`)
        .join("\n");
      return `Phần ${part.part_no}\n${speakers}`;
    })
    .join("\n\n");
  const response = await client.responses.parse({
    model: EXTRACTION_MODEL,
    reasoning: { effort: "low" },
    store: false, // don't keep medical conversations on OpenAI's side
    instructions: SPEAKER_INSTRUCTIONS,
    input: [{ role: "user", content: [{ type: "input_text", text }] }],
    text: { format: zodTextFormat(SpeakerRoles, "speaker_roles") },
  });
  if (!response.output_parsed) throw new Error("AI không trả về kết quả hợp lệ. Thử lại sau.");
  return parseSpeakerRoles(response.output_parsed.parts);
}

/** Lines `[m:ss] Speaker: text`. */
export function transcriptText(segments: Segment[]): string {
  return segments.map((s) => `[${formatTime(s.start)}] ${s.speaker}: ${s.text}`).join("\n");
}

const followUpDays = z
  .number()
  .int()
  .nullable()
  .describe("Relative re-examination delay in days ('2 tuần sau' = 14), when the doctor gave one instead of a date");

export const ConsultationExtraction = Extraction.extend({ follow_up_in_days: followUpDays });
export const InboxConsultationExtraction = InboxExtraction.extend({ follow_up_in_days: followUpDays });

const CONSULTATION_INSTRUCTIONS = (recordedOn: string) => `You read the transcript of a Vietnamese doctor consultation, recorded on ${recordedOn}. Each line is "[time] Role: text" with roles Bác sĩ, Bệnh nhân, Người nhà, Khác or Người nói (unknown). Extract it into structured data.

Rules:
- document_type is "consultation_recording".
- summary is Markdown in Vietnamese with exactly these five sections, in order: "### Lý do khám", "### Bác sĩ nói gì", "### Chẩn đoán", "### Dặn dò", "### Thuốc". Write "Không nhắc đến." under a section when nothing was said about it.
- observations only for a test or measurement the speakers named WITH a number (e.g. "đường huyết 7,2"); copy the value as spoken, unit null if not said. Never infer values.
- medications: name, with dose, schedule and duration as spoken.
- Follow-up: a relative delay ("tái khám 2 tuần sau") goes in follow_up_in_days (14) and follow_up_date stays null; an absolute date goes in follow_up_date (YYYY-MM-DD).
- document_date is ${recordedOn} unless a different date is spoken.
- facility and doctor only if said in the conversation.
- For test_code, only use a code from the catalog below; otherwise null. doctor_advice is only what the doctor told this patient to do. Put anything unclear in "uncertain". Do not add medical advice that was not said.
- Write everything in Vietnamese.`;

function postProcessConsultation<T extends z.infer<typeof ConsultationExtraction>>(
  parsed: T,
  recordedOn: string,
): Omit<T, "follow_up_in_days"> {
  const { follow_up_in_days, ...rest } = parsed;
  const result = {
    ...rest,
    document_type: "consultation_recording" as const,
    summary: normalizeConsultationSummary(parsed.summary),
    observations: cleanSpokenObservations(parsed.observations),
  };
  if (follow_up_in_days != null && !result.follow_up_date) {
    result.follow_up_date = followUpFrom(result.document_date ?? recordedOn, follow_up_in_days);
  }
  return result;
}

export async function extractConsultation(
  transcript: string,
  catalog: { code: string; name_vi: string }[],
  { recordedOn, model = EXTRACTION_MODEL }: { recordedOn: string; model?: string },
): Promise<{ result: ExtractionResult; skipped: string[]; usage: OpenAI.Responses.ResponseUsage | undefined }> {
  const catalogText = catalog.map((c) => `${c.code}: ${c.name_vi}`).join("\n");
  const client = new OpenAI();
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    store: false,
    instructions: `${CONSULTATION_INSTRUCTIONS(recordedOn)}\n\nTest catalog:\n${catalogText}`,
    input: [{ role: "user", content: [{ type: "input_text", text: transcript }] }],
    text: { format: zodTextFormat(ConsultationExtraction, "consultation") },
  });
  if (!response.output_parsed) throw new Error("AI không trả về kết quả hợp lệ. Thử lại sau.");
  return { result: postProcessConsultation(response.output_parsed, recordedOn), skipped: [], usage: response.usage };
}

export async function extractAndMatchConsultation(
  transcript: string,
  catalog: { code: string; name_vi: string }[],
  people: { id: string; full_name: string; birth_date: string | null; sex: string | null }[],
  casesByPerson: Record<string, { id: string; title: string; status: string; started_on: string | null }[]>,
  { recordedOn }: { recordedOn: string },
): Promise<{ result: InboxExtractionResult; skipped: string[] }> {
  const catalogText = catalog.map((c) => `${c.code}: ${c.name_vi}`).join("\n");
  const client = new OpenAI();
  const response = await client.responses.parse({
    model: EXTRACTION_MODEL,
    reasoning: { effort: "low" },
    store: false,
    instructions: `${CONSULTATION_INSTRUCTIONS(recordedOn)}\n${MATCH_INSTRUCTIONS}\n- patient_name is the name spoken in the conversation, if any; many consultations never say it, so use the roster context and set person_match_confidence "low" when unsure.\n\nTest catalog:\n${catalogText}\n\nGia đình và bệnh án hiện có:\n${buildRoster(people, casesByPerson)}`,
    input: [{ role: "user", content: [{ type: "input_text", text: transcript }] }],
    text: { format: zodTextFormat(InboxConsultationExtraction, "consultation_matched") },
  });
  if (!response.output_parsed) throw new Error("AI không trả về kết quả hợp lệ. Thử lại sau.");
  return { result: postProcessConsultation(response.output_parsed, recordedOn), skipped: [] };
}
