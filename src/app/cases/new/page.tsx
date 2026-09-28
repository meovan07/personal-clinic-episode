import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { CaseForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";

export default async function NewCasePage({ searchParams }: PageProps<"/cases/new">) {
  const { person: personId } = await searchParams;
  if (typeof personId !== "string") notFound();
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("full_name").eq("id", personId).maybeSingle();
  if (!person) notFound();
  return (
    <>
      <PageHeader back={{ href: `/people/${personId}`, label: person.full_name }} title="Thêm bệnh án" />
      <CaseForm personId={personId} />
    </>
  );
}
