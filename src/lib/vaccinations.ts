// Vaccination bookkeeping. Pure functions, no I/O.
import { nameKey } from "./normalize";

export type Dose = {
  vaccine_name: string;
  disease: string | null;
  given_on: string | null;
  next_due_on: string | null;
};

// Doses of the same series share a disease (e.g. "Cúm") even when the product name changes between years.
export function seriesKey(d: Pick<Dose, "vaccine_name" | "disease">): string {
  return nameKey(d.disease?.trim() || d.vaccine_name);
}

// Vaccination cards get re-photographed as doses are added, so the same dose shows up on several documents.
export function isSameDose(a: Dose, b: Dose): boolean {
  if (!a.given_on || a.given_on !== b.given_on) return false;
  return nameKey(a.vaccine_name) === nameKey(b.vaccine_name) || seriesKey(a) === seriesKey(b);
}

// Doses of the same series, oldest first, newest series activity first — for "which vaccines did I already take" views.
// Assumes `doses` is pre-sorted ascending by given_on (nulls first), as every query here selects it.
export function groupBySeries<T extends Dose>(doses: T[]): { key: string; title: string; doses: T[] }[] {
  const groups = new Map<string, { key: string; title: string; doses: T[] }>();
  for (const d of doses) {
    const key = seriesKey(d);
    const g = groups.get(key);
    if (g) g.doses.push(d);
    else groups.set(key, { key, title: d.disease ?? d.vaccine_name, doses: [d] });
  }
  return [...groups.values()].sort((a, b) =>
    (b.doses.at(-1)?.given_on ?? "").localeCompare(a.doses.at(-1)?.given_on ?? ""),
  );
}

// A dose's next_due_on is still open when no later dose of the same series has been recorded.
export function pendingDoses<T extends Dose>(doses: T[]): (T & { next_due_on: string })[] {
  return doses
    .filter((d): d is T & { next_due_on: string } => !!d.next_due_on)
    .filter(
      (d) =>
        !doses.some(
          (o) =>
            o !== d &&
            seriesKey(o) === seriesKey(d) &&
            !!o.given_on &&
            (!d.given_on || o.given_on > d.given_on),
        ),
    )
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on));
}
