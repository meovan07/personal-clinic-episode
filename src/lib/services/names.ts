import { canonicalName, onePlace } from "@/lib/names";
import type { Supabase } from "@/lib/services/records";

export type NameField = "facility" | "department" | "doctor" | "vaccine" | "disease" | "medication";

/**
 * Loads the names already in the records (visible to the caller, so both members' data) and returns a function
 * that turns a new value into the existing spelling of the same thing, or a tidied version of itself.
 */
export async function nameNormalizer(supabase: Supabase) {
  const [visits, vaccinations, medications] = await Promise.all([
    supabase.from("visits").select("facility, department, doctor"),
    supabase.from("vaccinations").select("vaccine_name, disease, facility"),
    supabase.from("medications").select("name"),
  ]);
  const v = visits.data ?? [];
  const vac = vaccinations.data ?? [];
  const known: Record<NameField, string[]> = {
    facility: [...v.map((r) => r.facility), ...vac.map((r) => r.facility)].filter((x): x is string => !!x),
    department: v.map((r) => r.department).filter((x): x is string => !!x),
    doctor: v.map((r) => r.doctor).filter((x): x is string => !!x),
    vaccine: vac.map((r) => r.vaccine_name),
    disease: vac.map((r) => r.disease).filter((x): x is string => !!x),
    medication: (medications.data ?? []).map((r) => r.name),
  };
  return (field: NameField, value: string | null | undefined): string | null => {
    const name = field === "facility" ? onePlace(value, known.facility) : canonicalName(value, known[field]);
    if (name) known[field].push(name); // later values in the same save match this one too
    return name;
  };
}
