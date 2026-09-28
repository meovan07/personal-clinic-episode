import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ReviewForm } from "@/components/ReviewForm";
import { Extraction } from "@/lib/ai/extract";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { DOC_TYPE } from "@/lib/labels";

export default async function ReviewPage({ params }: PageProps<"/documents/[id]/review">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*, visits(visit_date), document_files(storage_path, file_name, mime_type, page_no)")
    .eq("id", id)
    .order("page_no", { referencedTable: "document_files" })
    .maybeSingle();
  if (!doc) notFound();

  const parsed = Extraction.safeParse(doc.reviewed_json ?? doc.raw_ai_json);
  if (!parsed.success) notFound();

  const [{ data: signed }, { data: catalog }] = await Promise.all([
    supabase.storage.from("documents").createSignedUrls(
      doc.document_files.map((f) => f.storage_path),
      60 * 60,
    ),
    supabase.from("test_catalog").select("code, name_vi").order("category").order("name_vi"),
  ]);
  const previews = doc.document_files.map((f, i) => ({
    url: signed?.[i]?.signedUrl ?? "",
    name: f.file_name,
    mime: f.mime_type,
  }));

  return (
    <>
      <PageHeader
        back={{ href: `/visits/${doc.visit_id}`, label: `Khám ngày ${formatDate(doc.visits.visit_date)}` }}
        title="Kiểm tra kết quả AI đọc"
        subtitle={`${doc.title ?? DOC_TYPE[doc.doc_type]} · So sánh với bản gốc bên trái, sửa nếu sai rồi bấm Xác nhận.`}
      />
      <ReviewForm
        documentId={id}
        visitId={doc.visit_id}
        initial={parsed.data}
        previews={previews}
        catalog={catalog ?? []}
      />
    </>
  );
}
