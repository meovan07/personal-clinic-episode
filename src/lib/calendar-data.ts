import type { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/calendar";
import { pendingDoses } from "@/lib/vaccinations";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Everything with a date that belongs on the calendar, for one person or (personId omitted) everyone.
export async function loadCalendarEvents(supabase: Supabase, personId?: string): Promise<CalendarEvent[]> {
  let visitsQuery = supabase
    .from("visits")
    .select("id, visit_date, facility, person_id, people(full_name)")
    .not("visit_date", "is", null);
  let vaccinationsQuery = supabase
    .from("vaccinations")
    .select("id, vaccine_name, disease, dose_label, given_on, next_due_on, person_id, people(full_name)")
    .order("given_on", { ascending: true, nullsFirst: true });
  let todosQuery = supabase
    .from("action_items")
    .select("id, content, due_on, visit_id, person_id, people(full_name)")
    .eq("done", false)
    .not("due_on", "is", null);
  if (personId) {
    visitsQuery = visitsQuery.eq("person_id", personId);
    vaccinationsQuery = vaccinationsQuery.eq("person_id", personId);
    todosQuery = todosQuery.eq("person_id", personId);
  }
  const [visits, vaccinations, todos] = await Promise.all([visitsQuery, vaccinationsQuery, todosQuery]);
  return buildCalendarEvents({
    visits: visits.data ?? [],
    vaccinations: vaccinations.data ?? [],
    todos: todos.data ?? [],
  });
}

type Named = { person_id: string; people: { full_name: string } };
export type CalendarRows = {
  visits: (Named & { id: string; visit_date: string | null; facility: string | null })[];
  /** Ordered by given_on, earliest first (undated first). */
  vaccinations: (Named & {
    id: string;
    vaccine_name: string;
    disease: string | null;
    dose_label: string | null;
    given_on: string | null;
    next_due_on: string | null;
  })[];
  /** Open to-dos that have a due date. */
  todos: (Named & { id: string; content: string; due_on: string | null; visit_id: string | null })[];
};

// The rules for turning rows into calendar events, shared by the pages and the daily reminder job.
export function buildCalendarEvents({ visits, vaccinations, todos }: CalendarRows): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const v of visits) {
    if (!v.visit_date) continue;
    events.push({
      date: v.visit_date,
      kind: "visit",
      title: v.facility ?? "Lần khám",
      href: `/visits/${v.id}`,
      personName: v.people.full_name,
    });
  }

  // Next-dose dates only count while no later dose of the same series has been recorded.
  const dosesByPerson = new Map<string, CalendarRows["vaccinations"]>();
  for (const x of vaccinations) {
    dosesByPerson.set(x.person_id, [...(dosesByPerson.get(x.person_id) ?? []), x]);
    if (x.given_on) {
      events.push({
        date: x.given_on,
        kind: "vaccination",
        title: [x.disease ?? x.vaccine_name, x.dose_label].filter(Boolean).join(" · "),
        href: `/people/${x.person_id}/vaccinations`,
        personName: x.people.full_name,
      });
    }
  }
  const doseDueKeys = new Set<string>();
  for (const doses of dosesByPerson.values()) {
    for (const d of pendingDoses(doses)) {
      doseDueKeys.add(`${d.person_id}|${d.next_due_on}`);
      events.push({
        date: d.next_due_on,
        kind: "dose_due",
        title: `Mũi tiếp theo: ${d.disease ?? d.vaccine_name}`,
        href: `/people/${d.person_id}/vaccinations`,
        personName: d.people.full_name,
      });
    }
  }

  // The AI often turns "tiêm mũi tiếp theo" into a to-do on the same date as the vaccination book's
  // next-dose appointment; show that appointment once.
  for (const a of todos) {
    if (!a.due_on) continue;
    const isDoseReminder = /tiêm|vắc ?xin|vaccine/i.test(a.content);
    if (isDoseReminder && doseDueKeys.has(`${a.person_id}|${a.due_on}`)) continue;
    events.push({
      date: a.due_on,
      kind: "todo",
      title: a.content,
      href: a.visit_id ? `/visits/${a.visit_id}` : `/people/${a.person_id}`,
      personName: a.people.full_name,
    });
  }

  return events;
}
