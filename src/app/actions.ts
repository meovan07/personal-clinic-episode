"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Extraction, extractDocument, type ExtractFile } from "@/lib/ai/extract";
import { z } from "zod";
import { summarizePerson, type PersonSnapshot } from "@/lib/ai/summarize";
import { pushConfigured, sendPush } from "@/lib/push";
import * as inbox from "@/lib/services/inbox";
import * as records from "@/lib/services/records";
import { check, removeFilesUnder } from "@/lib/services/records";
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
  const saved = id ? await records.updateCase(supabase, id, row) : await records.createCase(supabase, row);
  revalidatePath("/", "layout");
  redirect(`/cases/${saved.id}`);
}

export async function deleteCase(id: string, personId: string) {
  const supabase = await createClient();
  await records.deleteCase(supabase, id);
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
  const saved = id ? await records.updateVisit(supabase, id, row) : await records.createVisit(supabase, row);
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
  const saved = await records.createVisit(supabase, row);
  revalidatePath("/", "layout");
  return saved.id;
}

export async function deleteVisit(id: string, personId: string) {
  const supabase = await createClient();
  await records.deleteVisit(supabase, id);
  revalidatePath("/", "layout");
  redirect(`/people/${personId}`);
}

// ---------- Documents ----------

// pending=true means the file is already sitting in the inbox, waiting for review (not yet a document).
export type DuplicateFile = { sha256: string; file_name: string; visit_id: string | null; pending: boolean };

export async function findDuplicateFiles(hashes: string[]): Promise<DuplicateFile[]> {
  const supabase = await createClient();
  const [docs, inbox] = await Promise.all([
    supabase
      .from("document_files")
      .select("sha256, file_name, documents!inner(visit_id)")
      .in("sha256", hashes)
      .then(check),
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
  await records.deleteDocument(supabase, id);
  revalidatePath(`/visits/${visitId}`);
}

// ---------- Medications ----------

export async function addMedication(fd: FormData) {
  const supabase = await createClient();
  const visitId = required(fd, "visit_id");
  const days = str(fd, "duration_days");
  await records.addMedication(supabase, {
    visit_id: visitId,
    name: required(fd, "name"),
    dose: str(fd, "dose"),
    schedule: str(fd, "schedule"),
    duration_days: days ? Number(days) : null,
    notes: str(fd, "notes"),
  });
  revalidatePath(`/visits/${visitId}`);
}

export async function deleteMedication(id: string, visitId: string) {
  const supabase = await createClient();
  await records.deleteMedication(supabase, id);
  revalidatePath(`/visits/${visitId}`);
}

// ---------- Action items ----------

export async function addActionItem(fd: FormData) {
  const supabase = await createClient();
  await records.addTodo(supabase, {
    person_id: required(fd, "person_id"),
    visit_id: str(fd, "visit_id"),
    content: required(fd, "content"),
    due_on: str(fd, "due_on"),
  });
  revalidatePath("/", "layout");
}

export async function updateActionItem(fd: FormData) {
  const supabase = await createClient();
  const id = required(fd, "id");
  const notes = str(fd, "notes");
  const content = await records.refineTodo(supabase, id, required(fd, "content"), notes);
  await records.updateTodo(supabase, id, { content, due_on: str(fd, "due_on"), notes });
  revalidatePath("/", "layout");
}

export async function setActionItemDone(id: string, done: boolean) {
  const supabase = await createClient();
  await records.updateTodo(supabase, id, { done });
  revalidatePath("/", "layout");
}

export async function deleteActionItem(id: string) {
  const supabase = await createClient();
  await records.deleteTodo(supabase, id);
  revalidatePath("/", "layout");
}

// ---------- Vaccinations (Phase 5) ----------

export async function addVaccination(fd: FormData) {
  const supabase = await createClient();
  const personId = required(fd, "person_id");
  await records.addVaccination(supabase, {
    person_id: personId,
    vaccine_name: required(fd, "vaccine_name"),
    disease: str(fd, "disease"),
    dose_label: str(fd, "dose_label"),
    given_on: str(fd, "given_on"),
    next_due_on: str(fd, "next_due_on"),
    lot_number: str(fd, "lot_number"),
    facility: str(fd, "facility"),
    notes: str(fd, "notes"),
  });
  revalidatePath(`/people/${personId}`, "layout");
}

export async function deleteVaccination(id: string, personId: string) {
  const supabase = await createClient();
  await records.deleteVaccination(supabase, id);
  revalidatePath(`/people/${personId}`, "layout");
}

// ---------- AI extraction (Phase 2) ----------

// The visit-relevant fields from a read, so a caller (NewVisitForm) can pre-fill the visit
// form immediately instead of waiting for the document confirm step to back-fill them.
type ReadResult = {
  error: string | null;
  visitFields?: {
    visit_date: string | null;
    facility: string | null;
    department: string | null;
    doctor: string | null;
  };
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
  check(
    await supabase
      .from("documents")
      .update({ extraction_status: "pending", extraction_error: null })
      .eq("id", documentId),
  );

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
    await supabase
      .from("documents")
      .update({ extraction_status: "failed", extraction_error: message })
      .eq("id", documentId);
    return { error: message };
  } finally {
    revalidatePath(`/visits/${doc.visit_id}`);
  }
}

// Saves the user-reviewed extraction as real rows. Re-confirming replaces the rows from the previous confirm.
export async function confirmExtraction(documentId: string, input: unknown) {
  const reviewed = Extraction.parse(input);
  const supabase = await createClient();
  const doc = check(await supabase.from("documents").select("visit_id").eq("id", documentId).single());
  await inbox.applyExtraction(supabase, { visitId: doc.visit_id, documentId, reviewed });
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
      supabase
        .from("action_items")
        .select("content, due_on, notes")
        .eq("person_id", personId)
        .eq("done", false)
        .then(check),
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
  await inbox.discardInboxItem(supabase, id);
  revalidatePath("/", "layout");
  redirect("/");
}

// Reads the file(s) with AI, and guesses the person / bệnh án / lần khám they belong to.
export async function processInboxItem(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  try {
    return await inbox.readInboxItem(supabase, id);
  } finally {
    revalidatePath("/", "layout");
  }
}

export type { CaseChoice, VisitChoice } from "@/lib/services/inbox";

// Turns a reviewed inbox item into a real document; see saveInboxItem.
export async function confirmInboxItem(
  inboxId: string,
  input: { personId: string; case: inbox.CaseChoice; visit: inbox.VisitChoice; reviewed: unknown },
) {
  const reviewed = Extraction.parse(input.reviewed);
  const supabase = await createClient();
  const { visitId } = await inbox.saveInboxItem(supabase, inboxId, { ...input, reviewed });
  revalidatePath("/", "layout");
  redirect(`/visits/${visitId}`);
}

// ---------- Push notifications (reminders) ----------

const PushSubscriptionInput = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Stores this device's push subscription for the signed-in member (re-subscribing replaces it). */
export async function savePushSubscription(input: unknown, userAgent: string | null) {
  const sub = PushSubscriptionInput.parse(input);
  const supabase = await createClient();
  check(
    await supabase.from("push_subscriptions").upsert(
      {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    ),
  );
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  check(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint));
}

/** Sends a test notification to the signed-in member's devices. */
export async function sendTestPush(): Promise<{ sent: number; error: string | null }> {
  if (!pushConfigured()) return { sent: 0, error: "Máy chủ chưa có khoá thông báo (VAPID)." };
  const supabase = await createClient();
  const subs = check(await supabase.from("push_subscriptions").select("endpoint, p256dh, auth"));
  let sent = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, {
      title: "Thông báo đã bật",
      body: "Mỗi sáng khoảng 8 giờ, Sổ bệnh án sẽ nhắc việc và lịch tiêm của hôm nay và ngày mai.",
      url: "/",
      tag: "test",
    });
    if (result === "sent") sent++;
    if (result === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
  return { sent, error: sent ? null : "Không gửi được tới thiết bị nào. Thử tắt rồi bật lại thông báo." };
}

// ---------- Profile ----------

/** The signed-in member's own display name (greeting, assistant). RLS allows only their own row and this column. */
export async function updateDisplayName(fd: FormData) {
  const name = required(fd, "display_name").replace(/\s+/g, " ").slice(0, 40);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  const { data, error } = await supabase
    .from("members")
    .update({ display_name: name })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Chưa đổi được tên. Cần chạy migration member_display_name trên Supabase.");
  revalidatePath("/", "layout");
}
