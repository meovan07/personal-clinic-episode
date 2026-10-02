import { tool } from "ai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { prepareCalendar, vietnamToday } from "@/lib/calendar";
import { loadCalendarEvents } from "@/lib/calendar-data";
import { nameKey } from "@/lib/normalize";
import { hitHref } from "@/lib/search";
import { pendingDoses } from "@/lib/vaccinations";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Read tools (Phase 8a); they run without approval. Every query runs with the signed-in user's Supabase session,
// so row-level security limits the agent to exactly what that user can see in the app.
// Results carry `url`s so the model can link its answers to the pages they came from.

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

function fail(message: string, error?: { message: string } | null) {
  throw new Error(error ? `${message}: ${error.message}` : message);
}

export function createReadTools(supabase: Supabase) {
  return {
    search_records: tool({
      description:
        "Full-text search over everything (visits, lab results, documents, medications, bệnh án, to-dos, vaccinations). " +
        "Ignores Vietnamese diacritics, understands everyday terms (mỡ máu, men gan, tiểu đường) and tolerates typos. " +
        "Good first step to find IDs.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Words to search for, e.g. 'LDL', 'Medilab', 'tiêm cúm'"),
      }),
      execute: async ({ query }) => {
        const { data, error } = await supabase.rpc("search_records", { q: query });
        if (error) fail("Search failed", error);
        return (data ?? []).slice(0, 40).map((h) => ({
          kind: h.kind,
          id: h.id,
          person: h.person_name,
          title: h.title,
          detail: h.detail,
          flag_or_status: h.tag,
          date: h.happened_on,
          approximate_match: h.approximate,
          url: hitHref(h),
        }));
      },
    }),

    get_person_overview: tool({
      description:
        "Profile of one person: allergies, history, bệnh án with status, number of visits, open to-dos, " +
        "upcoming vaccine doses and the latest AI health summary.",
      inputSchema: z.object({ person_id: uuid }),
      execute: async ({ person_id }) => {
        const [person, cases, visits, todos, vaccinations, summary] = await Promise.all([
          supabase.from("people").select("*").eq("id", person_id).maybeSingle(),
          supabase.from("cases").select("id, title, status, started_on, ended_on, notes").eq("person_id", person_id),
          supabase
            .from("visits")
            .select("visit_date")
            .eq("person_id", person_id)
            .order("visit_date", { ascending: false, nullsFirst: false }),
          supabase.from("action_items").select("id, content, due_on").eq("person_id", person_id).eq("done", false),
          supabase
            .from("vaccinations")
            .select("vaccine_name, disease, given_on, next_due_on")
            .eq("person_id", person_id)
            .order("given_on", { ascending: true, nullsFirst: true }),
          supabase
            .from("ai_summaries")
            .select("content, generated_at")
            .eq("person_id", person_id)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (!person.data) fail("Person not found", person.error);
        const p = person.data!;
        return {
          id: p.id,
          name: p.full_name,
          birth_date: p.birth_date,
          sex: p.sex,
          blood_type: p.blood_type,
          allergies: p.allergies,
          chronic_conditions: p.chronic_conditions,
          notes: p.notes,
          url: `/people/${p.id}`,
          doctor_summary_url: `/people/${p.id}/summary`,
          cases: (cases.data ?? []).map((c) => ({ ...c, url: `/cases/${c.id}` })),
          visit_count: visits.data?.length ?? 0,
          last_visit_date: visits.data?.find((v) => v.visit_date)?.visit_date ?? null,
          open_todos: todos.data ?? [],
          upcoming_doses: pendingDoses(vaccinations.data ?? []).map((d) => ({
            vaccine: d.disease ?? d.vaccine_name,
            due_on: d.next_due_on,
          })),
          latest_ai_summary: summary.data ?? null,
        };
      },
    }),

    list_visits: tool({
      description: "List visits (lần khám), newest first, optionally for one person and/or within a date range.",
      inputSchema: z.object({
        person_id: uuid.optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ person_id, from, to, limit }) => {
        let q = supabase
          .from("visits")
          .select(
            "id, visit_date, facility, department, doctor, reason, people(full_name), cases(title), documents(count)",
          )
          .order("visit_date", { ascending: false, nullsFirst: false })
          .limit(limit);
        if (person_id) q = q.eq("person_id", person_id);
        if (from) q = q.gte("visit_date", from);
        if (to) q = q.lte("visit_date", to);
        const { data, error } = await q;
        if (error) fail("Could not list visits", error);
        return (data ?? []).map((v) => ({
          id: v.id,
          date: v.visit_date,
          person: v.people.full_name,
          facility: v.facility,
          department: v.department,
          doctor: v.doctor,
          reason: v.reason,
          case: v.cases?.title ?? null,
          documents: v.documents[0]?.count ?? 0,
          url: `/visits/${v.id}`,
        }));
      },
    }),

    get_visit: tool({
      description:
        "Everything about one visit: details, documents, lab results, medications and to-dos (with their ids).",
      inputSchema: z.object({ visit_id: uuid }),
      execute: async ({ visit_id }) => {
        const [visit, documents, observations, medications, todos] = await Promise.all([
          supabase.from("visits").select("*, people(full_name), cases(id, title)").eq("id", visit_id).maybeSingle(),
          supabase.from("documents").select("id, title, doc_type, summary, extraction_status").eq("visit_id", visit_id),
          supabase
            .from("observations")
            .select(
              "raw_name, value, value_text, unit, raw_value, raw_unit, ref_range_text, flag, test_catalog(name_vi)",
            )
            .eq("visit_id", visit_id),
          supabase
            .from("medications")
            .select("id, name, dose, schedule, duration_days, notes")
            .eq("visit_id", visit_id),
          supabase.from("action_items").select("id, content, due_on, done").eq("visit_id", visit_id),
        ]);
        if (!visit.data) fail("Visit not found", visit.error);
        const v = visit.data!;
        return {
          id: v.id,
          date: v.visit_date,
          person: v.people.full_name,
          facility: v.facility,
          department: v.department,
          doctor: v.doctor,
          reason: v.reason,
          notes: v.notes,
          case: v.cases ? { title: v.cases.title, url: `/cases/${v.cases.id}` } : null,
          url: `/visits/${v.id}`,
          documents: documents.data ?? [],
          results: (observations.data ?? []).map((o) => ({
            test: o.test_catalog?.name_vi ?? o.raw_name,
            value: o.value ?? o.value_text,
            unit: o.unit,
            as_printed: o.raw_unit && o.raw_unit !== o.unit ? `${o.raw_value} ${o.raw_unit}` : undefined,
            reference_range: o.ref_range_text,
            flag: o.flag,
          })),
          medications: medications.data ?? [],
          todos: todos.data ?? [],
        };
      },
    }),

    get_test_history: tool({
      description:
        "One lab test (or a group, e.g. 'mỡ máu') over time for a person: every result with date, unit, " +
        "reference range and flag, oldest first. Accepts a test name, code (LDL, ALT, GLUCOSE) or everyday term.",
      inputSchema: z.object({
        test: z.string().min(1),
        person_id: uuid.optional(),
      }),
      execute: async ({ test, person_id }) => {
        const key = nameKey(test);
        const { data: catalog, error: catalogError } = await supabase
          .from("test_catalog")
          .select("code, name_vi, aliases, search_terms");
        if (catalogError) fail("Could not read the test catalog", catalogError);
        const words = (c: NonNullable<typeof catalog>[number]) =>
          [c.code, c.name_vi, ...c.aliases, ...c.search_terms].map(nameKey);
        const codes = new Set(
          (catalog ?? []).filter((c) => words(c).some((w) => w === key || w.includes(key))).map((c) => c.code),
        );

        let q = supabase
          .from("observations")
          .select(
            "raw_name, test_code, value, value_text, unit, ref_range_text, flag, visit_id, test_catalog(name_vi), visits!inner(visit_date, person_id, people(full_name))",
          );
        if (person_id) q = q.eq("visits.person_id", person_id);
        const { data, error } = await q;
        if (error) fail("Could not read results", error);

        const matching = (data ?? []).filter(
          (o) => (o.test_code && codes.has(o.test_code)) || nameKey(o.raw_name).includes(key),
        );
        const series = new Map<string, { test: string; person: string; results: unknown[] }>();
        for (const o of matching.sort((a, b) => (a.visits.visit_date ?? "").localeCompare(b.visits.visit_date ?? ""))) {
          const test = o.test_catalog?.name_vi ?? o.raw_name;
          const person = o.visits.people.full_name;
          const id = `${person}|${test}`;
          if (!series.has(id)) series.set(id, { test, person, results: [] });
          series.get(id)!.results.push({
            date: o.visits.visit_date,
            value: o.value ?? o.value_text,
            unit: o.unit,
            reference_range: o.ref_range_text,
            flag: o.flag,
            url: `/visits/${o.visit_id}`,
          });
        }
        return series.size ? [...series.values()] : { message: `No results found for "${test}".` };
      },
    }),

    list_todos: tool({
      description: "To-dos (việc cần làm, doctor's advice, follow-ups), optionally for one person.",
      inputSchema: z.object({ person_id: uuid.optional(), include_done: z.boolean().default(false) }),
      execute: async ({ person_id, include_done }) => {
        let q = supabase
          .from("action_items")
          .select("id, content, notes, due_on, done, visit_id, person_id, people(full_name)")
          .order("due_on", { ascending: true, nullsFirst: false });
        if (person_id) q = q.eq("person_id", person_id);
        if (!include_done) q = q.eq("done", false);
        const { data, error } = await q;
        if (error) fail("Could not list to-dos", error);
        return (data ?? []).map((a) => ({
          id: a.id,
          person: a.people.full_name,
          content: a.content,
          notes: a.notes,
          due_on: a.due_on,
          done: a.done,
          url: a.visit_id ? `/visits/${a.visit_id}` : `/people/${a.person_id}`,
        }));
      },
    }),

    list_vaccinations: tool({
      description: "Vaccination history of one person (oldest first) and the doses still due.",
      inputSchema: z.object({ person_id: uuid }),
      execute: async ({ person_id }) => {
        const { data, error } = await supabase
          .from("vaccinations")
          .select("id, vaccine_name, disease, dose_label, given_on, next_due_on, facility, notes")
          .eq("person_id", person_id)
          .order("given_on", { ascending: true, nullsFirst: true });
        if (error) fail("Could not list vaccinations", error);
        return {
          doses: data ?? [],
          upcoming: pendingDoses(data ?? []).map((d) => ({
            vaccine: d.disease ?? d.vaccine_name,
            due_on: d.next_due_on,
          })),
          url: `/people/${person_id}/vaccinations`,
        };
      },
    }),

    get_calendar: tool({
      description:
        "Dated events between two dates: past visits and vaccinations, upcoming or overdue to-dos and vaccine doses.",
      inputSchema: z.object({ from: isoDate, to: isoDate, person_id: uuid.optional() }),
      execute: async ({ from, to, person_id }) => {
        const events = await loadCalendarEvents(supabase, person_id);
        return prepareCalendar(events, vietnamToday())
          .events.filter((e) => e.date >= from && e.date <= to)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => ({
            date: e.date,
            kind: e.kind,
            status: e.status,
            title: e.title,
            person: e.personName,
            url: e.href,
          }));
      },
    }),
  };
}

export type ReadTools = ReturnType<typeof createReadTools>;
