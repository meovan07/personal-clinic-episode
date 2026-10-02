import {
  Extraction,
  extractAndMatchDocument,
  InboxExtraction,
  withExtractionDefaults,
  type ExtractFile,
  type ExtractionResult,
} from "@/lib/ai/extract";
import { today } from "@/lib/format";
import { normalizeObservation } from "@/lib/normalize";
import { check, type Supabase } from "@/lib/services/records";
import { isSameDose, pendingDoses } from "@/lib/vaccinations";

// Documents that arrive without a known visit ("+" quick add, or a photo sent in the chat): the AI reads
// them and guesses who/which bệnh án/which visit they belong to, then the user confirms. Also the shared
// step that turns a reviewed extraction into rows. Shared by the server actions and the chat tools.

// Reads the file(s) with AI, and guesses the person / bệnh án / lần khám they belong to.
export async function readInboxItem(supabase: Supabase, id: string): Promise<{ error: string | null }> {
  const item = check(
    await supabase
      .from("inbox_items")
      .select("id, inbox_files(storage_path, file_name, mime_type, page_no)")
      .eq("id", id)
      .order("page_no", { referencedTable: "inbox_files" })
      .single(),
  );
  check(await supabase.from("inbox_items").update({ status: "processing", error: null }).eq("id", id));

  try {
    const files: ExtractFile[] = [];
    for (const f of item.inbox_files) {
      const { data, error } = await supabase.storage.from("documents").download(f.storage_path);
      if (error) throw new Error(`Không tải được file ${f.file_name}: ${error.message}`);
      files.push({
        name: f.file_name,
        mime: f.mime_type ?? data.type,
        bytes: Buffer.from(await data.arrayBuffer()),
      });
    }

    const [catalog, people, cases] = await Promise.all([
      supabase.from("test_catalog").select("code, name_vi").order("code").then(check),
      supabase.from("people").select("id, full_name, birth_date, sex").order("created_at").then(check),
      supabase.from("cases").select("id, person_id, title, status, started_on").then(check),
    ]);
    const casesByPerson: Record<string, typeof cases> = {};
    for (const c of cases) (casesByPerson[c.person_id] ??= []).push(c);

    const { result, skipped } = await extractAndMatchDocument(files, catalog, people, casesByPerson);
    if (skipped.length > 0) result.uncertain.push(`Bỏ qua file không đọc được: ${skipped.join(", ")}`);

    // Deterministic visit grouping: same person + same date, and if both sides have a facility, it must match too.
    // This is what makes multiple pieces of evidence about the same visit land on one lần khám instead of two.
    let suggestedVisitId: string | null = null;
    if (result.matched_person_id && result.document_date) {
      const candidates = check(
        await supabase
          .from("visits")
          .select("id, facility")
          .eq("person_id", result.matched_person_id)
          .eq("visit_date", result.document_date),
      );
      suggestedVisitId =
        candidates.find((v) => !result.facility || !v.facility || v.facility === result.facility)?.id ?? null;
    }

    check(
      await supabase
        .from("inbox_items")
        .update({
          extraction: result,
          status: "needs_review",
          error: null,
          suggested_person_id: result.matched_person_id,
          suggested_case_id: result.matched_case_id,
          suggested_is_new_case: result.is_new_case,
          suggested_new_case_title: result.new_case_title,
          suggested_visit_id: suggestedVisitId,
        })
        .eq("id", id),
    );
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("inbox_items").update({ status: "failed", error: message }).eq("id", id);
    return { error: message };
  }
}

export type CaseChoice = { type: "existing"; id: string } | { type: "new"; title: string } | { type: "none" };
export type VisitChoice =
  | { type: "existing"; id: string }
  | {
      type: "new";
      visit_date: string | null;
      facility: string | null;
      department: string | null;
      doctor: string | null;
    };

// Turns a reviewed inbox item into a real document: resolves/creates the bệnh án and lần khám the user picked,
// then applies the extraction the same way confirmExtraction does for the manual flow.
export async function saveInboxItem(
  supabase: Supabase,
  inboxId: string,
  input: { personId: string; case: CaseChoice; visit: VisitChoice; reviewed: ExtractionResult },
): Promise<{ visitId: string; documentId: string }> {
  const { reviewed } = input;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const item = check(
    await supabase
      .from("inbox_items")
      .select("id, inbox_files(page_no, storage_path, file_name, mime_type, size_bytes, sha256)")
      .eq("id", inboxId)
      .order("page_no", { referencedTable: "inbox_files" })
      .single(),
  );

  let visitId: string;
  if (input.visit.type === "existing") {
    visitId = input.visit.id;
  } else {
    let caseId: string | null = null;
    if (input.case.type === "existing") caseId = input.case.id;
    else if (input.case.type === "new") {
      caseId = check(
        await supabase
          .from("cases")
          .insert({ person_id: input.personId, title: input.case.title, started_on: input.visit.visit_date })
          .select("id")
          .single(),
      ).id;
    }
    visitId = check(
      await supabase
        .from("visits")
        .insert({
          person_id: input.personId,
          case_id: caseId,
          visit_date: input.visit.visit_date,
          facility: input.visit.facility,
          department: input.visit.department,
          doctor: input.visit.doctor,
        })
        .select("id")
        .single(),
    ).id;
  }

  const doc = check(
    await supabase
      .from("documents")
      .insert({ visit_id: visitId, doc_type: reviewed.document_type, uploaded_by: user?.id })
      .select("id")
      .single(),
  );
  const { error } = await supabase.from("document_files").insert(
    item.inbox_files.map((f) => ({
      document_id: doc.id,
      page_no: f.page_no,
      storage_path: f.storage_path,
      file_name: f.file_name,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      sha256: f.sha256,
    })),
  );
  if (error) {
    await supabase.from("documents").delete().eq("id", doc.id);
    throw new Error(error.message);
  }

  await applyExtraction(supabase, { visitId, documentId: doc.id, reviewed });
  // The inbox row (and its now-superseded inbox_files rows) can go; the files themselves live on under document_files.
  check(await supabase.from("inbox_items").delete().eq("id", inboxId));

  return { visitId, documentId: doc.id };
}

// Writes a reviewed extraction into real rows against an already-known visit: observations, medications,
// action items, filling in blank visit fields, and marking the document confirmed. Re-running it (a re-confirm,
// or the inbox flow right after creating the document) replaces any rows from a previous run for this document.
// Shared by confirmExtraction (existing manual visit->upload flow) and confirmInboxItem (quick-add flow).
export async function applyExtraction(
  supabase: Supabase,
  { visitId, documentId, reviewed }: { visitId: string; documentId: string; reviewed: ExtractionResult },
) {
  const visit = check(
    await supabase
      .from("visits")
      .select("person_id, visit_date, facility, department, doctor")
      .eq("id", visitId)
      .single(),
  );
  const [catalog, conversions] = await Promise.all([
    supabase.from("test_catalog").select("code, name_vi, aliases, standard_unit").then(check),
    supabase.from("unit_conversions").select("test_code, from_unit, factor").then(check),
  ]);

  await Promise.all([
    supabase.from("observations").delete().eq("document_id", documentId).then(check),
    supabase.from("medications").delete().eq("document_id", documentId).then(check),
    supabase.from("action_items").delete().eq("document_id", documentId).then(check),
    supabase.from("vaccinations").delete().eq("document_id", documentId).then(check),
  ]);

  const observations = reviewed.observations
    .filter((o) => o.raw_name.trim() && o.value.trim())
    .map((o) => ({
      ...normalizeObservation(o, catalog, conversions),
      visit_id: visitId,
      document_id: documentId,
    }));
  if (observations.length) check(await supabase.from("observations").insert(observations));

  const medications = reviewed.medications
    .filter((m) => m.name.trim())
    .map((m) => ({
      visit_id: visitId,
      document_id: documentId,
      name: m.name.trim(),
      dose: m.dose,
      schedule: m.schedule,
      duration_days: m.duration_days,
      notes: m.notes,
    }));
  if (medications.length) check(await supabase.from("medications").insert(medications));

  // Skip doses already recorded from another photo of the same vaccination card (or added by hand).
  const knownDoses = check(
    await supabase
      .from("vaccinations")
      .select("vaccine_name, disease, given_on, next_due_on")
      .eq("person_id", visit.person_id),
  );
  const vaccinations = reviewed.vaccinations
    .filter((v) => v.vaccine_name.trim())
    .map((v) => ({
      person_id: visit.person_id,
      visit_id: visitId,
      document_id: documentId,
      vaccine_name: v.vaccine_name.trim(),
      disease: v.disease,
      dose_label: v.dose_label,
      given_on: v.given_on,
      next_due_on: v.next_due_on,
      lot_number: v.lot_number,
      facility: v.facility ?? reviewed.facility,
      typically_single_dose: v.typically_single_dose,
    }))
    .filter((v) => !knownDoses.some((k) => isSameDose(k, v)));
  if (vaccinations.length) check(await supabase.from("vaccinations").insert(vaccinations));

  const base = { person_id: visit.person_id, visit_id: visitId, document_id: documentId };
  // With a follow-up date, the advice line about re-examination becomes the dated to-do instead of a duplicate.
  const advice = reviewed.doctor_advice.map((a) => a.trim()).filter(Boolean);
  const followUpLine = reviewed.follow_up_date ? advice.find((a) => /^tái khám/i.test(a)) : undefined;
  const actions: (typeof base & { content: string; due_on?: string })[] = advice
    .filter((a) => a !== followUpLine)
    .map((content) => ({ ...base, content }));
  if (reviewed.follow_up_date) {
    actions.push({ ...base, content: followUpLine ?? "Tái khám", due_on: reviewed.follow_up_date });
  }
  // Next-dose appointments from this document that are still ahead and not already covered by a later dose.
  const fromThisDocument = new Set<object>(vaccinations);
  const upcoming = pendingDoses([...knownDoses, ...vaccinations]).filter(
    (d) => fromThisDocument.has(d) && d.next_due_on >= today(),
  );
  for (const d of upcoming) {
    actions.push({ ...base, content: `Tiêm mũi tiếp theo: ${d.vaccine_name}`, due_on: d.next_due_on });
  }
  if (actions.length) check(await supabase.from("action_items").insert(actions));

  // Fill in visit details the user left empty.
  const visitPatch: { visit_date?: string; facility?: string; department?: string; doctor?: string } = {};
  for (const k of ["facility", "department", "doctor"] as const) {
    const found = reviewed[k];
    if (!visit[k] && found) visitPatch[k] = found;
  }
  if (!visit.visit_date && reviewed.document_date) visitPatch.visit_date = reviewed.document_date;
  if (Object.keys(visitPatch).length) check(await supabase.from("visits").update(visitPatch).eq("id", visitId));

  const summary = [
    reviewed.summary.trim(),
    reviewed.diagnoses.length ? `Chẩn đoán: ${reviewed.diagnoses.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  check(
    await supabase
      .from("documents")
      .update({ doc_type: reviewed.document_type, summary, reviewed_json: reviewed, extraction_status: "confirmed" })
      .eq("id", documentId),
  );
}

/** Removes an inbox item that won't be kept, with its uploaded files. */
export async function discardInboxItem(supabase: Supabase, id: string) {
  const rows = check(await supabase.from("inbox_files").select("storage_path").eq("inbox_item_id", id));
  if (rows.length > 0) {
    const { error } = await supabase.storage.from("documents").remove(rows.map((r) => r.storage_path));
    if (error) throw new Error(error.message);
  }
  check(await supabase.from("inbox_items").delete().eq("id", id));
}

/** An inbox item with its AI reading, or null if it isn't visible. `extraction` is null until it has been read. */
export async function loadInboxItem(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("inbox_items")
    .select("id, status, error, extraction, suggested_visit_id, inbox_files(file_name, page_no)")
    .eq("id", id)
    .order("page_no", { referencedTable: "inbox_files" })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const parsed =
    data.status === "needs_review" ? InboxExtraction.safeParse(withExtractionDefaults(data.extraction)) : null;
  return {
    id: data.id,
    status: data.status,
    error: data.error,
    files: data.inbox_files.map((f) => f.file_name),
    suggestedVisitId: data.suggested_visit_id,
    extraction: parsed?.success ? parsed.data : null,
  };
}

/** The part of an inbox reading that becomes rows (drops the person/case guesses). */
export function reviewedFrom(extraction: NonNullable<Awaited<ReturnType<typeof loadInboxItem>>>["extraction"]) {
  return Extraction.parse(extraction);
}
