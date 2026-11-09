import type { createClient } from "@/lib/supabase/server";
import type { ActionItemRow } from "@/components/ActionItems";
import type { VisitRow } from "@/components/VisitList";
import type { ObservationRow } from "@/lib/results";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// What the public_* RPCs return (supabase/migrations/20261109000000_public_read.sql), in the shapes the pages already use.
type Vaccination = {
  id: string;
  vaccine_name: string;
  disease: string | null;
  dose_label: string | null;
  given_on: string | null;
  next_due_on: string | null;
};

export type PublicPerson = {
  id: string;
  full_name: string;
  birth_date: string | null;
  sex: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  cases: {
    id: string;
    person_id: string;
    title: string;
    status: string;
    started_on: string | null;
    ended_on: string | null;
    visits: { count: number }[];
  }[];
  visits: VisitRow[];
  observations: ObservationRow[];
  latest_summary: { id: string; content: string; generated_at: string } | null;
  older_summary_count: number;
  vaccinations: (Vaccination & { person_id: string })[];
  /** Open to-dos with a due date only. */
  todos: { id: string; person_id: string; visit_id: string | null; content: string; due_on: string | null }[];
};

export type PublicVisit = {
  id: string;
  person_id: string;
  case_id: string | null;
  visit_date: string | null;
  facility: string | null;
  department: string | null;
  doctor: string | null;
  reason: string | null;
  notes: string | null;
  people: { full_name: string } | null;
  cases: { id: string; title: string } | null;
  documents: {
    id: string;
    title: string | null;
    doc_type: string | null;
    created_at: string;
    summary: string | null;
    document_files: { id: string; page_no: number; file_name: string | null; mime_type: string | null }[];
  }[];
  medications: {
    id: string;
    visit_id: string;
    name: string;
    dose: string | null;
    schedule: string | null;
    duration_days: number | null;
    notes: string | null;
  }[];
  action_items: ActionItemRow[];
  observations: (Omit<ObservationRow, "visit_id" | "test_catalog"> & {
    id: string;
    raw_value: string | null;
    test_catalog: { name_vi: string } | null;
  })[];
  vaccinations: Vaccination[];
};

export type PublicCase = {
  id: string;
  person_id: string;
  title: string;
  status: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  people: { full_name: string } | null;
  visits: VisitRow[];
  observations: ObservationRow[];
  action_items: ActionItemRow[];
};

const record = (json: unknown) =>
  json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
const list = (v: unknown) => (Array.isArray(v) ? v : []);

export function toPublicPerson(json: unknown): PublicPerson | null {
  const j = record(json);
  if (!j) return null;
  return {
    ...j,
    birth_date: j.birth_date ?? null,
    sex: j.sex ?? null,
    blood_type: j.blood_type ?? null,
    allergies: j.allergies ?? null,
    chronic_conditions: j.chronic_conditions ?? null,
    cases: list(j.cases),
    visits: list(j.visits),
    observations: list(j.observations),
    latest_summary: j.latest_summary ?? null,
    older_summary_count: j.older_summary_count ?? 0,
    vaccinations: list(j.vaccinations),
    todos: list(j.todos),
  } as PublicPerson;
}

export function toPublicVisit(json: unknown): PublicVisit | null {
  const j = record(json);
  if (!j) return null;
  return {
    ...j,
    case_id: j.case_id ?? null,
    visit_date: j.visit_date ?? null,
    facility: j.facility ?? null,
    department: j.department ?? null,
    doctor: j.doctor ?? null,
    reason: j.reason ?? null,
    notes: j.notes ?? null,
    people: j.people ?? null,
    cases: j.cases ?? null,
    documents: list(j.documents),
    medications: list(j.medications),
    action_items: list(j.action_items),
    observations: list(j.observations),
    vaccinations: list(j.vaccinations),
  } as PublicVisit;
}

export function toPublicCase(json: unknown): PublicCase | null {
  const j = record(json);
  if (!j) return null;
  return {
    ...j,
    started_on: j.started_on ?? null,
    ended_on: j.ended_on ?? null,
    notes: j.notes ?? null,
    people: j.people ?? null,
    visits: list(j.visits),
    observations: list(j.observations),
    action_items: list(j.action_items),
  } as PublicCase;
}

// Pages treat a missing row as notFound(), so an RPC error is logged and returned as null.
async function call<T>(supabase: Supabase, fn: "public_person" | "public_visit" | "public_case", id: string, map: (j: unknown) => T | null) {
  const { data, error } = await supabase.rpc(fn, { p_id: id });
  if (error) console.error(`${fn} failed`, error.message);
  return error ? null : map(data);
}

export const getPublicPerson = (supabase: Supabase, id: string) => call(supabase, "public_person", id, toPublicPerson);
export const getPublicVisit = (supabase: Supabase, id: string) => call(supabase, "public_visit", id, toPublicVisit);
export const getPublicCase = (supabase: Supabase, id: string) => call(supabase, "public_case", id, toPublicCase);
