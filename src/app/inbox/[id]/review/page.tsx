import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { InboxReviewForm } from "@/components/InboxReviewForm";
import { InboxRetry } from "@/components/InboxRetry";
import { InboxExtraction, withExtractionDefaults } from "@/lib/ai/extract";
import { createClient } from "@/lib/supabase/server";

// AI extraction/matching runs inside a server action triggered from this page and can take a minute.
export const maxDuration = 300;

export default async function InboxReviewPage({ params }: PageProps<"/inbox/[id]/review">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inbox_items")
    .select(
      "id, status, error, extraction, suggested_person_id, suggested_case_id, suggested_is_new_case, suggested_new_case_title, suggested_visit_id, inbox_files(storage_path, file_name, mime_type, page_no)",
    )
    .eq("id", id)
    .order("page_no", { referencedTable: "inbox_files" })
    .maybeSingle();
  if (!item) notFound();

  return (
    <>
      <PageHeader back={{ href: "/", label: "Trang chủ" }} title="Tài liệu mới" subtitle="AI đọc và đoán người bệnh / bệnh án, bạn kiểm tra lại rồi xác nhận." />
      {item.status !== "needs_review" ? (
        <InboxRetry id={id} error={item.error} />
      ) : (
        <ReviewBody item={item} />
      )}
    </>
  );
}

async function ReviewBody({
  item,
}: {
  item: {
    id: string;
    extraction: unknown;
    suggested_person_id: string | null;
    suggested_case_id: string | null;
    suggested_is_new_case: boolean;
    suggested_new_case_title: string | null;
    suggested_visit_id: string | null;
    inbox_files: { storage_path: string; file_name: string; mime_type: string | null; page_no: number }[];
  };
}) {
  const parsed = InboxExtraction.safeParse(withExtractionDefaults(item.extraction));
  if (!parsed.success) notFound();

  const supabase = await createClient();
  const [{ data: people }, { data: cases }, { data: catalog }, { data: suggestedVisit }, { data: signed }] = await Promise.all([
    supabase.from("people").select("id, full_name").order("created_at"),
    supabase.from("cases").select("id, person_id, title, status").order("started_on", { ascending: false }),
    supabase.from("test_catalog").select("code, name_vi").order("category").order("name_vi"),
    item.suggested_visit_id
      ? supabase
          .from("visits")
          .select("id, visit_date, facility, department, doctor, case_id, cases(title)")
          .eq("id", item.suggested_visit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.storage.from("documents").createSignedUrls(
      item.inbox_files.map((f) => f.storage_path),
      60 * 60,
    ),
  ]);
  const previews = item.inbox_files.map((f, i) => ({
    url: signed?.[i]?.signedUrl ?? "",
    name: f.file_name,
    mime: f.mime_type,
  }));

  return (
    <InboxReviewForm
      inboxId={item.id}
      initial={parsed.data}
      people={people ?? []}
      cases={cases ?? []}
      catalog={catalog ?? []}
      previews={previews}
      suggestedPersonId={item.suggested_person_id}
      suggestedCaseId={item.suggested_case_id}
      suggestedIsNewCase={item.suggested_is_new_case}
      suggestedNewCaseTitle={item.suggested_new_case_title}
      suggestedVisit={suggestedVisit}
    />
  );
}
