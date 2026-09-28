import Link from "next/link";
import { ActionItems } from "@/components/ActionItems";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate } from "@/lib/format";

const INBOX_STATUS: Record<string, string> = {
  processing: "🕓 Đang xử lý…",
  needs_review: "🤖 AI đã đọc xong, cần xác nhận",
  failed: "⚠ Lỗi khi đọc, bấm để thử lại",
};

export default async function Home() {
  const supabase = await createClient();
  const [people, visits, actions, inbox] = await Promise.all([
    supabase
      .from("people")
      .select("id, full_name, birth_date, cases(status), visits(visit_date)")
      .order("created_at"),
    supabase
      .from("visits")
      .select("id, visit_date, facility, reason, cases(title), people(full_name), documents(count)")
      .order("visit_date", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("action_items")
      .select("id, content, due_on, done, visit_id, people(full_name)")
      .eq("done", false)
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase
      .from("inbox_items")
      .select("id, status, inbox_files(file_name)")
      .order("created_at"),
  ]);

  return (
    <div className="space-y-8">
      {inbox.data && inbox.data.length > 0 && (
        <section>
          <h2 className="section-title">Tài liệu mới tải lên</h2>
          <div className="space-y-2">
            {inbox.data.map((item) => (
              <Link key={item.id} href={`/inbox/${item.id}/review`} className="card flex items-center justify-between gap-2 hover:border-teal-300">
                <span>{item.inbox_files.map((f) => f.file_name).join(", ")}</span>
                <span className="muted whitespace-nowrap">{INBOX_STATUS[item.status] ?? item.status}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Hồ sơ</h2>
          <Link href="/people/new" className="btn">
            + Thêm người
          </Link>
        </div>
        {people.data?.length === 0 && <p className="muted">Bắt đầu bằng cách thêm hồ sơ cho bạn và người yêu.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {people.data?.map((p) => {
            const lastVisit = p.visits
              .map((v) => v.visit_date)
              .filter((d): d is string => !!d)
              .sort()
              .at(-1);
            const active = p.cases.filter((c) => c.status === "dang_dieu_tri").length;
            const a = age(p.birth_date);
            return (
              <Link key={p.id} href={`/people/${p.id}`} className="card hover:border-teal-300">
                <div className="text-lg font-semibold">{p.full_name}</div>
                <div className="muted">
                  {a !== null && `${a} tuổi · `}
                  {p.visits.length} lần khám
                  {active > 0 && ` · ${active} bệnh đang điều trị`}
                </div>
                {lastVisit && <div className="muted">Khám gần nhất: {formatDate(lastVisit)}</div>}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">Việc cần làm</h2>
        <div className="card">
          <ActionItems items={actions.data ?? []} showPerson />
        </div>
      </section>

      <section>
        <h2 className="section-title">Lần khám gần đây</h2>
        <VisitList visits={visits.data ?? []} showPerson />
      </section>
    </div>
  );
}
