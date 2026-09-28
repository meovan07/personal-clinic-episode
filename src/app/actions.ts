"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    visit_date: required(fd, "visit_date"),
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

export async function deleteVisit(id: string, personId: string) {
  const supabase = await createClient();
  await removeFilesUnder(supabase, (q) => q.eq("documents.visit_id", id));
  check(await supabase.from("visits").delete().eq("id", id));
  revalidatePath("/", "layout");
  redirect(`/people/${personId}`);
}

// ---------- Documents ----------

export type DuplicateFile = { sha256: string; file_name: string; visit_id: string };

export async function findDuplicateFiles(hashes: string[]): Promise<DuplicateFile[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("document_files")
      .select("sha256, file_name, documents!inner(visit_id)")
      .in("sha256", hashes),
  );
  return rows.map((r) => ({ sha256: r.sha256, file_name: r.file_name, visit_id: r.documents.visit_id }));
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
}) {
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
  check(
    await supabase.from("action_items").insert({
      person_id: required(fd, "person_id"),
      visit_id: str(fd, "visit_id"),
      content: required(fd, "content"),
      due_on: str(fd, "due_on"),
    }),
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
