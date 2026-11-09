import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { polishActionItem, refineActionItem } from "@/lib/ai/polish";
import { nameNormalizer } from "@/lib/services/names";
import type { createClient } from "@/lib/supabase/server";
import { partPathsToDelete } from "@/lib/transcript";

// Create/update/delete for the records, shared by the server actions (forms) and the chat assistant's tools.
// Every function takes the caller's Supabase client, so row-level security applies exactly as in the UI.
// Nothing here redirects or revalidates; that's the caller's job.

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export function check<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

// Deletes the stored originals for the matching document_files before their rows cascade away.
export async function removeFilesUnder(
  supabase: Supabase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: (q: any) => any,
) {
  const query = supabase
    .from("document_files")
    .select("storage_path, documents!inner(visit_id, visits!inner(person_id))");
  const rows = check(await filter(query)) as { storage_path: string }[];
  if (rows.length > 0) {
    const { error } = await supabase.storage.from("documents").remove(rows.map((r) => r.storage_path));
    if (error) throw new Error(error.message);
  }
}

type PartOwner = { column: "document_id" | "inbox_item_id"; id: string };

/** Storage paths of an owner's temporary transcription part files. */
export async function partFilePaths(supabase: Supabase, owner: PartOwner): Promise<string[]> {
  const rows = check(await supabase.from("transcript_parts").select("storage_path").eq(owner.column, owner.id));
  return partPathsToDelete(rows);
}

/** Removes part files from storage. Best effort: a failure is logged, never thrown (the caller's DB work stands). */
export async function removePartFiles(supabase: Supabase, paths: string[]) {
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from("documents").remove(paths);
    if (error) console.error("removePartFiles", error.message);
  } catch (e) {
    console.error("removePartFiles", e);
  }
}

/** After a confirm: drops the document's transcript_parts rows and their storage files. Never throws. */
export async function cleanupDocumentParts(supabase: Supabase, documentId: string) {
  try {
    const paths = await partFilePaths(supabase, { column: "document_id", id: documentId });
    if (paths.length === 0) return;
    check(await supabase.from("transcript_parts").delete().eq("document_id", documentId));
    await removePartFiles(supabase, paths);
  } catch (e) {
    console.error("cleanupDocumentParts", e);
  }
}

// ---------- Cases ----------

export async function createCase(supabase: Supabase, row: TablesInsert<"cases">) {
  return check(await supabase.from("cases").insert(row).select("id").single());
}

export async function updateCase(supabase: Supabase, id: string, patch: TablesUpdate<"cases">) {
  return check(await supabase.from("cases").update(patch).eq("id", id).select("id").single());
}

// Visits stay (they just leave the case), so no files are removed here.
export async function deleteCase(supabase: Supabase, id: string) {
  check(await supabase.from("cases").delete().eq("id", id));
}

// ---------- Visits ----------

// Facility, department and doctor reuse the spelling already in the records (see lib/names.ts).
async function withVisitNames<
  T extends { facility?: string | null; department?: string | null; doctor?: string | null },
>(supabase: Supabase, row: T): Promise<T> {
  if (!row.facility && !row.department && !row.doctor) return row;
  const name = await nameNormalizer(supabase);
  return {
    ...row,
    ...(row.facility !== undefined && { facility: name("facility", row.facility) }),
    ...(row.department !== undefined && { department: name("department", row.department) }),
    ...(row.doctor !== undefined && { doctor: name("doctor", row.doctor) }),
  };
}

export async function createVisit(supabase: Supabase, row: TablesInsert<"visits">) {
  const named = await withVisitNames(supabase, row);
  return check(await supabase.from("visits").insert(named).select("id").single());
}

export async function updateVisit(supabase: Supabase, id: string, patch: TablesUpdate<"visits">) {
  const named = await withVisitNames(supabase, patch);
  return check(await supabase.from("visits").update(named).eq("id", id).select("id").single());
}

/** Storage paths of transcription part files for every document under a visit or person. */
export async function partFilePathsUnder(supabase: Supabase, owner: { column: "visit_id" | "person_id"; id: string }) {
  const query = supabase.from("transcript_parts").select("storage_path, documents!inner(visit_id, visits!inner(person_id))");
  const rows = check(
    await query.eq(owner.column === "visit_id" ? "documents.visit_id" : "documents.visits.person_id", owner.id),
  );
  return partPathsToDelete(rows);
}

export async function deleteVisit(supabase: Supabase, id: string) {
  // Part rows cascade with the documents; their files don't, so note the paths first and remove them last.
  const partPaths = await partFilePathsUnder(supabase, { column: "visit_id", id });
  await removeFilesUnder(supabase, (q) => q.eq("documents.visit_id", id));
  check(await supabase.from("visits").delete().eq("id", id));
  await removePartFiles(supabase, partPaths);
}

// ---------- Documents ----------

export async function deleteDocument(supabase: Supabase, id: string) {
  // Part rows cascade with the document; their files don't, so note the paths first and remove them last.
  const partPaths = await partFilePaths(supabase, { column: "document_id", id });
  await removeFilesUnder(supabase, (q) => q.eq("document_id", id));
  check(await supabase.from("documents").delete().eq("id", id));
  await removePartFiles(supabase, partPaths);
}

// ---------- Medications ----------

export async function addMedication(supabase: Supabase, row: TablesInsert<"medications">) {
  const name = await nameNormalizer(supabase);
  const named = { ...row, name: name("medication", row.name) ?? row.name };
  return check(await supabase.from("medications").insert(named).select("id").single());
}

export async function deleteMedication(supabase: Supabase, id: string) {
  check(await supabase.from("medications").delete().eq("id", id));
}

// ---------- Action items (to-dos) ----------

/** Adds a to-do; `polish` rewrites the text into a clear instruction (best effort). */
export async function addTodo(supabase: Supabase, row: TablesInsert<"action_items">, { polish = true } = {}) {
  const content = polish ? await polishActionItem(row.content).catch(() => row.content) : row.content;
  return check(
    await supabase
      .from("action_items")
      .insert({ ...row, content })
      .select("id")
      .single(),
  );
}

// The added context isn't just stored, and isn't just rephrased in isolation either: the AI
// gets the real family roster and the person's recent visits/cases so it can actually resolve
// a vague reference ("chồng" -> the other family member's real name) or a vague test name
// against what was actually recorded, instead of only parroting back what the user typed.
export async function refineTodo(supabase: Supabase, id: string, raw: string, notes: string | null) {
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
    ...visits.map(
      (v) => `- Khám ${v.visit_date ?? "(chưa rõ ngày)"}: ${v.reason ?? v.facility ?? "(không ghi lý do)"}`,
    ),
  ].join("\n");
  return refineActionItem({ content: raw, notes, people, forPersonName: person.full_name, recentContext }).catch(
    () => raw,
  );
}

export async function updateTodo(supabase: Supabase, id: string, patch: TablesUpdate<"action_items">) {
  return check(await supabase.from("action_items").update(patch).eq("id", id).select("id").single());
}

export async function deleteTodo(supabase: Supabase, id: string) {
  check(await supabase.from("action_items").delete().eq("id", id));
}

// ---------- Vaccinations ----------

export async function addVaccination(supabase: Supabase, row: TablesInsert<"vaccinations">) {
  const name = await nameNormalizer(supabase);
  const named = {
    ...row,
    vaccine_name: name("vaccine", row.vaccine_name) ?? row.vaccine_name,
    disease: name("disease", row.disease),
    facility: name("facility", row.facility),
  };
  return check(await supabase.from("vaccinations").insert(named).select("id").single());
}

export async function updateVaccination(supabase: Supabase, id: string, patch: TablesUpdate<"vaccinations">) {
  return check(await supabase.from("vaccinations").update(patch).eq("id", id).select("id").single());
}

export async function deleteVaccination(supabase: Supabase, id: string) {
  check(await supabase.from("vaccinations").delete().eq("id", id));
}
