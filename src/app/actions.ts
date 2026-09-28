"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Extraction,
  extractAndMatchDocument,
  extractDocument,
  type ExtractFile,
  type ExtractionResult,
} from "@/lib/ai/extract";
import { polishActionItem, refineActionItem } from "@/lib/ai/polish";
import { summarizePerson, type PersonSnapshot } from "@/lib/ai/summarize";
import { today } from "@/lib/format";
import { normalizeObservation } from "@/lib/normalize";
import { isSameDose, pendingDoses } from "@/lib/vaccinations";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function required(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (!v) throw new Error(`Thiếu thông tin: ${key}`);
  return v;
}

function check<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

// ---------- Auth ----------

export async function signIn(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: required(fd, "email"),
    password: required(fd, "password"),
  });
  if (error) return "Email hoặc mật khẩu không đúng.";
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- People ----------

export async function savePerson(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const row = {
    full_name: required(fd, "full_name"),
    birth_date: str(fd, "birth_date"),
    sex: str(fd, "sex"),
    blood_type: str(fd, "blood_type"),
    allergies: str(fd, "allergies"),
    chronic_conditions: str(fd, "chronic_conditions"),
    notes: str(fd, "notes"),
  };
  const saved = id
    ? check(await supabase.from("people").update(row).eq("id", id).select("id").single())
    : check(await supabase.from("people").insert(row).select("id").single());
  revalidatePath("/", "layout");
  redirect(`/people/${saved.id}`);
}

export async function deletePerson(id: string) {
  const supabase = await createClient();
  await removeFilesUnder(supabase, (q) => q.eq("documents.visits.person_id", id));
  check(await supabase.from("people").delete().eq("id", id));
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Cases ----------

export async function saveCase(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const row = {
    person_id: required(fd, "person_id"),
    title: required(fd, "title"),
    status: required(fd, "status"),
    started_on: str(fd, "started_on"),
    ended_on: str(fd, "ended_on"),
    notes: str(fd, "notes"),
  };
  const saved = id
    ? check(await supabase.from("cases").update(row).eq("id", id).select("id").single())
    : check(await supabase.from("cases").insert(row).select("id").single());
  revalidatePath("/", "layout");
  redirect(`/cases/${saved.id}`);
}

export async function deleteCase(id: string, personId: string) {
  const supabase = await createClient();
  // Visits stay (they just leave the case), so no files are removed here.
  check(await supabase.from("cases").delete().eq("id", id));
  revalidatePath("/", "layout");
  redirect(`/people/${personId}`);
}

// ---------- Visits ----------

export async function saveVisit(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const row = {
    person_id: required(fd, "person_id"),
    case_id: str(fd, "case_id"),
    visit_date: str(fd, "visit_date"),
    facility: str(fd, "facility"),
    department: str(fd, "department"),
    doctor: str(fd, "doctor"),
    reason: str(fd, "reason"),
    notes: str(fd, "notes"),
  };
  const saved = id
    ? check(await supabase.from("visits").update(row).eq("id", id).select("id").single())
    : check(await supabase.from("visits").insert(row).select("id").single());
  revalidatePath("/", "layout");
  redirect(`/visits/${saved.id}`);
}

// Used by the client-driven "thêm lần khám" flow (NewVisitForm), which may attach a photo
// and jump straight to AI review - it needs the new id back, so it can't use the
// redirect()-throwing saveVisit above.
export async function createVisit(fd: FormData): Promise<string> {
  const supabase = await createClient();
  const row = {
    person_id: required(fd, "person_id"),
    case_id: str(fd, "case_id"),
    visit_date: str(fd, "visit_date"),
    facility: str(fd, "facility"),
    department: str(fd, "department"),
    doctor: str(fd, "doctor"),
    reason: str(fd, "reason"),
    notes: str(fd, "notes"),
  };
  const saved = check(await supabase.from("visits").insert(row).select("id").single());
  revalidatePath("/", "layout");
  return saved.id;
}

export async function deleteVisit(id: string, personId: string) {
  const supabase = await createClient();
  await removeFilesUnder(supabase, (q) => q.eq("documents.visit_id", id));
  check(await supabase.from("visits").delete().eq("id", id));
  revalidatePath("/", "layout");
  redirect(`/people/${personId}`);
}

// ---------- Documents ----------

// pending=true means the file is already sitting in the inbox, waiting for review (not yet a document).
export type DuplicateFile = { sha256: string; file_name: string; visit_id: string | null; pending: boolean };

export async function findDuplicateFiles(hashes: string[]): Promise<DuplicateFile[]> {
  const supabase = await createClient();
  const [docs, inbox] = await Promise.all([
    supabase.from("document_files").select("sha256, file_name, documents!inner(visit_id)").in("sha256", hashes).then(check),
    supabase.from("inbox_files").select("sha256, file_name").in("sha256", hashes).then(check),
  ]);
  return [
    ...docs.map((r) => ({ sha256: r.sha256, file_name: r.file_name, visit_id: r.documents.visit_id, pending: false })),
    ...inbox.map((r) => ({ sha256: r.sha256, file_name: r.file_name, visit_id: null, pending: true })),
  ];
}

export type UploadedFile = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
};

export async function createDocument(input: {
  visitId: string;
  title: string | null;
  docType: string;
  files: UploadedFile[];
}): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const doc = check(
    await supabase
      .from("documents")
      .insert({ visit_id: input.visitId, title: input.title, doc_type: input.docType, uploaded_by: user?.id })
      .select("id")
      .single(),
  );
  const { error } = await supabase
    .from("document_files")
    .insert(input.files.map((f, i) => ({ ...f, document_id: doc.id, page_no: i + 1 })));
  if (error) {
    await supabase.from("documents").delete().eq("id", doc.id);
    throw new Error(error.message);
  }
  revalidatePath(`/visits/${input.visitId}`);
  return doc.id;
}

export async function deleteDocument(id: string, visitId: string) {
  const supabase = await createClient();
  await removeFilesUnder(supabase, (q) => q.eq("document_id", id));
  check(await supabase.from("documents").delete().eq("id", id));
  revalidatePath(`/visits/${visitId}`);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Deletes the stored originals for the matching document_files before their rows cascade away.
async function removeFilesUnder(
  supabase: Supabase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: (q: any) => any,
) {
  const query = supabase.from("document_files").select("storage_path, documents!inner(visit_id, visits!inner(person_id))");
  const rows = check(await filter(query)) as { storage_path: string }[];
  if (rows.length > 0) {
    const { error } = await supabase.storage.from("documents").remove(rows.map((r) => r.storage_path));
    if (error) throw new Error(error.message);
  }
}

// ---------- Medications ----------

export async function addMedication(fd: FormData) {
  const supabase = await createClient();
  const visitId = required(fd, "visit_id");
  const days = str(fd, "duration_days");
  check(
    await supabase.from("medications").insert({
      visit_id: visitId,
      name: required(fd, "name"),
      dose: str(fd, "dose"),
      schedule: str(fd, "schedule"),
      duration_days: days ? Number(days) : null,
      notes: str(fd, "notes"),
    }),
  );
  revalidatePath(`/visits/${visitId}`);
}

export async function deleteMedication(id: string, visitId: string) {
  const supabase = await createClient();
  check(await supabase.from("medications").delete().eq("id", id));
  revalidatePath(`/visits/${visitId}`);
}

// ---------- Action items ----------

export async function addActionItem(fd: FormData) {
  const supabase = await createClient();
  const raw = required(fd, "content");
  const content = await polishActionItem(raw).catch(() => raw); // AI polish is best-effort
  check(
    await supabase.from("action_items").insert({
      person_id: required(fd, "person_id"),
      visit_id: str(fd, "visit_id"),
      content,
      due_on: str(fd, "due_on"),
    }),
  );
  revalidatePath("/", "layout");
}

// The added context isn't just stored, and isn't just rephrased in isolation either: the AI
// gets the real family roster and the person's recent visits/cases so it can actually resolve
// a vague reference ("chồng" -> the other family member's real name) or a vague test name
// against what was actually recorded, instead of only parroting back what the user typed.
export async function updateActionItem(fd: FormData) {
  const supabase = await createClient();
  const id = required(fd, "id");
  const raw = required(fd, "content");
  const notes = str(fd, "notes");

  const item = check(await supabase.from("action_items").select("person_id").eq("id", id).single());
  const [people, person, visits, cases] = await Promise.all([
    supabase.from("people").select("id, full_name, sex").order("created_at").then(check),
    supabase.from("people").select("full_name").eq("id", item.person_id).single().then(check),
    supabase
      .from("visits")
      .select("visit_date, facility, reason")
      .eq("person_id", item.person_id)
      .order("visit_date", { ascending: false, nullsFirst: false })
      .limit(5)
      .then(check),
    supabase.from("cases").select("title, status").eq("person_id", item.person_id).then(check),
  ]);
  const recentContext = [
    ...cases.map((c) => `- Bệnh án: ${c.title} (${c.status})`),
    ...visits.map((v) => `- Khám ${v.visit_date ?? "(chưa rõ ngày)"}: ${v.reason ?? v.facility ?? "(không ghi lý do)"}`),
  ].join("\n");

  const content = await refineActionItem({ content: raw, notes, people, forPersonName: person.full_name, recentContext }).catch(
    () => raw,
  );
  check(
    await supabase
      .from("action_items")
      .update({ content, due_on: str(fd, "due_on"), notes })
      .eq("id", id),
  );
  revalidatePath("/", "layout");
}

export async function setActionItemDone(id: string, done: boolean) {
  const supabase = await createClient();
  check(await supabase.from("action_items").update({ done }).eq("id", id));
  revalidatePath("/", "layout");
}

export async function deleteActionItem(id: string) {
  const supabase = await createClient();
  check(await supabase.from("action_items").delete().eq("id", id));
  revalidatePath("/", "layout");
}

// ---------- Vaccinations (Phase 5) ----------

export async function addVaccination(fd: FormData) {
  const supabase = await createClient();
  const personId = required(fd, "person_id");
  check(
    await supabase.from("vaccinations").insert({
      person_id: personId,
      vaccine_name: required(fd, "vaccine_name"),
      disease: str(fd, "disease"),
      dose_label: str(fd, "dose_label"),
      given_on: str(fd, "given_on"),
      next_due_on: str(fd, "next_due_on"),
      lot_number: str(fd, "lot_number"),
      facility: str(fd, "facility"),
      notes: str(fd, "notes"),
    }),
  );
  revalidatePath(`/people/${personId}`, "layout");
}

export async function deleteVaccination(id: string, personId: string) {
  const supabase = await createClient();
  check(await supabase.from("vaccinations").delete().eq("id", id));
  revalidatePath(`/people/${personId}`, "layout");
}

// ---------- AI extraction (Phase 2) ----------

// The visit-relevant fields from a read, so a caller (NewVisitForm) can pre-fill the visit
// form immediately instead of waiting for the document confirm step to back-fill them.
type ReadResult = {
  error: string | null;
  visitFields?: { visit_date: string | null; facility: string | null; department: string | null; doctor: string | null };
};

export async function readDocumentWithAI(documentId: string): Promise<ReadResult> {
  const supabase = await createClient();
  const doc = check(
    await supabase
      .from("documents")
      .select("id, visit_id, document_files(storage_path, file_name, mime_type, page_no)")
      .eq("id", documentId)
      .order("page_no", { referencedTable: "document_files" })
      .single(),
  );
  check(await supabase.from("documents").update({ extraction_status: "pending", extraction_error: null }).eq("id", documentId));

  try {
    const files: ExtractFile[] = [];
    for (const f of doc.document_files) {
      const { data, error } = await supabase.storage.from("documents").download(f.storage_path);
      if (error) throw new Error(`Không tải được file ${f.file_name}: ${error.message}`);
      files.push({
        name: f.file_name,
        mime: f.mime_type ?? data.type,
        bytes: Buffer.from(await data.arrayBuffer()),
      });
    }
    const catalog = check(await supabase.from("test_catalog").select("code, name_vi").order("code"));
    const { result, skipped } = await extractDocument(files, catalog);
    if (skipped.length > 0) result.uncertain.push(`Bỏ qua file không đọc được: ${skipped.join(", ")}`);

    check(
      await supabase
        .from("documents")
        .update({
          raw_ai_json: result,
          reviewed_json: null,
          extraction_status: "needs_review",
          extracted_at: new Date().toISOString(),
        })
        .eq("id", documentId),
    );
    return {
      error: null,
      visitFields: {
        visit_date: result.document_date,
        facility: result.facility,
        department: result.department,
        doctor: result.doctor,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("documents").update({ extraction_status: "failed", extraction_error: message }).eq("id", documentId);
    return { error: message };
  } finally {
    revalidatePath(`/visits/${doc.visit_id}`);
  }
}

// Writes a reviewed extraction into real rows against an already-known visit: observations, medications,
// action items, filling in blank visit fields, and marking the document confirmed. Re-running it (a re-confirm,
// or the inbox flow right after creating the document) replaces any rows from a previous run for this document.
// Shared by confirmExtraction (existing manual visit->upload flow) and confirmInboxItem (quick-add flow).
async function applyExtraction(
  supabase: Supabase,
  { visitId, documentId, reviewed }: { visitId: string; documentId: string; reviewed: ExtractionResult },
) {
  const visit = check(
    await supabase.from("visits").select("person_id, visit_date, facility, department, doctor").eq("id", visitId).single(),
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
    await supabase.from("vaccinations").select("vaccine_name, disease, given_on, next_due_on").eq("person_id", visit.person_id),
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

// Saves the user-reviewed extraction as real rows. Re-confirming replaces the rows from the previous confirm.
export async function confirmExtraction(documentId: string, input: unknown) {
  const reviewed = Extraction.parse(input);
  const supabase = await createClient();
  const doc = check(await supabase.from("documents").select("visit_id").eq("id", documentId).single());
  await applyExtraction(supabase, { visitId: doc.visit_id, documentId, reviewed });
  revalidatePath("/", "layout");
  redirect(`/visits/${doc.visit_id}`);
}

// ---------- AI person summary (Phase 3) ----------

export async function generatePersonSummary(personId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  try {
    const [person, cases, visits, openActions, vaccinations, lastSummary] = await Promise.all([
      supabase
        .from("people")
        .select("full_name, sex, birth_date, blood_type, allergies, chronic_conditions")
        .eq("id", personId)
        .single()
        .then(check),
      supabase.from("cases").select("title, status, started_on, ended_on").eq("person_id", personId).then(check),
      supabase
        .from("visits")
        .select(
          "visit_date, facility, department, doctor, reason, cases(title), documents(summary, extraction_status), medications(name, dose, schedule), observations(raw_name, value, value_text, unit, flag, test_catalog(name_vi, category))",
        )
        .eq("person_id", personId)
        .order("visit_date", { ascending: true, nullsFirst: false })
        .then(check),
      supabase.from("action_items").select("content, due_on, notes").eq("person_id", personId).eq("done", false).then(check),
      supabase
        .from("vaccinations")
        .select("vaccine_name, disease, dose_label, given_on, next_due_on")
        .eq("person_id", personId)
        .order("given_on", { ascending: true, nullsFirst: true })
        .then(check),
      supabase
        .from("ai_summaries")
        .select("content, generated_at")
        .eq("person_id", personId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => {
          if (r.error) throw new Error(r.error.message);
          return r.data;
        }),
    ]);

    const snapshot: PersonSnapshot = {
      person,
      cases,
      visits: visits.map((v) => ({
        visit_date: v.visit_date,
        facility: v.facility,
        department: v.department,
        doctor: v.doctor,
        reason: v.reason,
        case_title: v.cases?.title ?? null,
        document_summaries: v.documents
          .filter((d): d is typeof d & { summary: string } => d.extraction_status === "confirmed" && !!d.summary)
          .map((d) => d.summary),
        medications: v.medications,
        observations: v.observations.map((o) => ({
          name: o.test_catalog?.name_vi ?? o.raw_name,
          category: o.test_catalog?.category ?? null,
          value: o.value !== null ? String(o.value) : o.value_text,
          unit: o.unit,
          flag: o.flag,
        })),
      })),
      open_action_items: openActions,
      vaccinations,
      previous_summary: lastSummary ? { content: lastSummary.content, generated_at: lastSummary.generated_at } : null,
    };

    const content = await summarizePerson(snapshot);
    check(await supabase.from("ai_summaries").insert({ person_id: personId, content, input_snapshot: snapshot }));
    revalidatePath(`/people/${personId}`);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Inbox ("+" quick add): upload first, AI figures out who/what it belongs to ----------

export async function createInboxItem(files: UploadedFile[]): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const item = check(await supabase.from("inbox_items").insert({ uploaded_by: user?.id }).select("id").single());
  const { error } = await supabase
    .from("inbox_files")
    .insert(files.map((f, i) => ({ ...f, inbox_item_id: item.id, page_no: i + 1 })));
  if (error) {
    await supabase.from("inbox_items").delete().eq("id", item.id);
    throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  return { id: item.id };
}

export async function discardInboxItem(id: string) {
  const supabase = await createClient();
  const rows = check(await supabase.from("inbox_files").select("storage_path").eq("inbox_item_id", id));
  if (rows.length > 0) {
    const { error } = await supabase.storage.from("documents").remove(rows.map((r) => r.storage_path));
    if (error) throw new Error(error.message);
  }
  check(await supabase.from("inbox_items").delete().eq("id", id));
  revalidatePath("/", "layout");
  redirect("/");
}

// Reads the file(s) with AI, and guesses the person / bệnh án / lần khám they belong to.
export async function processInboxItem(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
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
  } finally {
    revalidatePath("/", "layout");
  }
}

export type CaseChoice = { type: "existing"; id: string } | { type: "new"; title: string } | { type: "none" };
export type VisitChoice =
  | { type: "existing"; id: string }
  | { type: "new"; visit_date: string | null; facility: string | null; department: string | null; doctor: string | null };

// Turns a reviewed inbox item into a real document: resolves/creates the bệnh án and lần khám the user picked,
// then applies the extraction the same way confirmExtraction does for the manual flow.
export async function confirmInboxItem(
  inboxId: string,
  input: { personId: string; case: CaseChoice; visit: VisitChoice; reviewed: unknown },
) {
  const reviewed = Extraction.parse(input.reviewed);
  const supabase = await createClient();
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

  revalidatePath("/", "layout");
  redirect(`/visits/${visitId}`);
}
