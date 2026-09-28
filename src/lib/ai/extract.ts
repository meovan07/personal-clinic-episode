import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";

// Only used on the server: OPENAI_API_KEY must never reach the browser.

export const DOC_TYPES = [
  "lab_result",
  "imaging_report",
  "prescription",
  "discharge_summary",
  "visit_note",
  "invoice",
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
  uncertain: z.array(z.string()).describe("Vietnamese notes about anything hard to read or ambiguous"),
});

export type ExtractionResult = z.infer<typeof Extraction>;

export type ExtractFile = { name: string; mime: string; bytes: Buffer };

const INSTRUCTIONS = `You read Vietnamese medical documents (lab results, imaging reports, prescriptions, discharge papers, visit notes) photographed or scanned by the patient, and extract them into structured data.

Rules:
- The files are pages of ONE document, in order.
- Copy names, values, units and reference ranges exactly as printed. Never convert units or fix numbers; the app does that.
- Every measured value becomes one observation, including vital signs (weight, blood pressure, pulse) written on visit notes. Blood pressure "120/80" becomes two observations (BP_SYS, BP_DIA).
- For test_code, only use a code from the catalog below; if nothing matches, use null.
- If something is unreadable, leave it out or null and mention it in "uncertain". Never guess numbers.
- doctor_advice is only what a doctor told THIS patient to do (lifestyle, diet, medication use, re-examination). Printed boilerplate that appears on every sheet (e.g. "Kết quả chỉ có giá trị trên mẫu xét nghiệm", "Mẫu được lưu 24 giờ", "gặp bác sĩ nếu kết quả bất thường") is NOT advice; leave it out.
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

export async function extractDocument(
  files: ExtractFile[],
  catalog: { code: string; name_vi: string }[],
): Promise<{ result: ExtractionResult; skipped: string[] }> {
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

  const catalogText = catalog.map((c) => `${c.code}: ${c.name_vi}`).join("\n");
  const client = new OpenAI();
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
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
  return { result: response.output_parsed, skipped };
}
