import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { NewVisitForm } from "@/components/NewVisitForm";
import { createClient } from "@/lib/supabase/server";

// The attached-photo path calls readDocumentWithAI, which can take up to a minute.
export const maxDuration = 300;

export default async function NewVisitPage({ searchParams }: PageProps<"/visits/new">) {
  const { person: personId, case: caseId } = await searchParams;
  if (typeof personId !== "string") notFound();
  const supabase = await createClient();
  const [{ data: person }, { data: cases }] = await Promise.all([
    supabase.from("people").select("full_name").eq("id", personId).maybeSingle(),
    supabase.from("cases").select("id, title").eq("person_id", personId).order("started_on", { ascending: false }),
  ]);
  if (!person) notFound();
  return (
    <>
      <PageHeader back={{ href: `/people/${personId}`, label: person.full_name }} title="Thêm lần khám" />
      <NewVisitForm personId={personId} cases={cases ?? []} defaultCaseId={typeof caseId === "string" ? caseId : undefined} />
    </>
  );
}
