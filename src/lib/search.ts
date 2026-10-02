import type { Database } from "@/lib/database.types";

export type SearchHit = Database["public"]["Functions"]["search_records"]["Returns"][number];

// Where each kind of search_records hit lives in the app. Shared by the search popup and the chat agent.
export function hitHref(h: Pick<SearchHit, "kind" | "id" | "person_id" | "visit_id">): string {
  switch (h.kind) {
    case "visit":
      return `/visits/${h.id}`;
    case "observation":
    case "document":
    case "medication":
      return `/visits/${h.visit_id}`;
    case "case":
      return `/cases/${h.id}`;
    case "action_item":
      return h.visit_id ? `/visits/${h.visit_id}` : `/people/${h.person_id}`;
    case "vaccination":
      return `/people/${h.person_id}/vaccinations`;
    default:
      return `/people/${h.person_id}`;
  }
}
