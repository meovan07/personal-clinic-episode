import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { VisitForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";

export default async function EditVisitPage({ params }: PageProps<"/visits/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", id).maybeSingle();
  if (!visit) notFound();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, title")
    .eq("person_id", visit.person_id)
    .order("started_on", { ascending: false });
  return (
    <>
      <PageHeader back={{ href: `/visits/${id}`, label: "Lần khám" }} title="Sửa lần khám" />
      <VisitForm personId={visit.person_id} cases={cases ?? []} visit={visit} />
    </>
  );
}
