import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { CaseForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";

export default async function EditCasePage({ params }: PageProps<"/cases/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();
  return (
    <>
      <PageHeader back={{ href: `/cases/${id}`, label: item.title }} title="Sửa bệnh án" />
      <CaseForm personId={item.person_id} item={item} />
    </>
  );
}
