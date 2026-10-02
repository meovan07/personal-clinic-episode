import { PageHeader } from "@/components/PageHeader";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";

// Every visit of both people, newest first (the home page shows only the latest three).
export default async function VisitsPage() {
  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("visits")
    .select("id, visit_date, facility, reason, cases(title), people(full_name), documents(count)")
    .order("visit_date", { ascending: false, nullsFirst: false });
  return (
    <div>
      <PageHeader back={{ href: "/", label: "Trang chủ" }} title="Tất cả lần khám" subtitle={`${visits?.length ?? 0} lần khám`} />
      <VisitList visits={visits ?? []} showPerson />
    </div>
  );
}
