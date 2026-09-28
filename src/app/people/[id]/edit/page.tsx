import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PersonForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";

export default async function EditPersonPage({ params }: PageProps<"/people/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();
  return (
    <>
      <PageHeader back={{ href: `/people/${id}`, label: person.full_name }} title="Sửa hồ sơ" />
      <PersonForm person={person} />
    </>
  );
}
