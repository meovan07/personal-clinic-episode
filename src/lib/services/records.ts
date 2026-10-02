import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { polishActionItem, refineActionItem } from "@/lib/ai/polish";
import type { createClient } from "@/lib/supabase/server";

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

export async function createVisit(supabase: Supabase, row: TablesInsert<"visits">) {
  return check(await supabase.from("visits").insert(row).select("id").single());
}

export async function updateVisit(supabase: Supabase, id: string, patch: TablesUpdate<"visits">) {
  return check(await supabase.from("visits").update(patch).eq("id", id).select("id").single());
}

export async function deleteVisit(supabase: Supabase, id: string) {
  await removeFilesUnder(supabase, (q) => q.eq("documents.visit_id", id));
  check(await supabase.from("visits").delete().eq("id", id));
}

// ---------- Documents ----------

export async function deleteDocument(supabase: Supabase, id: string) {
  await removeFilesUnder(supabase, (q) => q.eq("document_id", id));
  check(await supabase.from("documents").delete().eq("id", id));
}

// ---------- Medications ----------

export async function addMedication(supabase: Supabase, row: TablesInsert<"medications">) {
  return check(await supabase.from("medications").insert(row).select("id").single());
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
  return check(await supabase.from("vaccinations").insert(row).select("id").single());
}

export async function updateVaccination(supabase: Supabase, id: string, patch: TablesUpdate<"vaccinations">) {
  return check(await supabase.from("vaccinations").update(patch).eq("id", id).select("id").single());
}

export async function deleteVaccination(supabase: Supabase, id: string) {
  check(await supabase.from("vaccinations").delete().eq("id", id));
}
