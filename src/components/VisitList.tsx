import Link from "next/link";
import { ChevronRight, Folder, Paperclip } from "lucide-react";
import { tidyName } from "@/lib/format";

export type VisitRow = {
  id: string;
  visit_date: string | null;
  facility: string | null;
  reason: string | null;
  cases?: { title: string } | null;
  people?: { full_name: string } | null;
  documents?: { count: number }[];
};

// Visits as one list: a date block on the left (day and month large, year small), where and why on the right.
export function VisitList({ visits, showPerson = false }: { visits: VisitRow[]; showPerson?: boolean }) {
  if (visits.length === 0) return <p className="muted">Chưa có lần khám nào.</p>;
  return (
    <ul className="card divide-y divide-line py-1">
      {visits.map((v) => {
        const docCount = v.documents?.[0]?.count ?? 0;
        const [y, m, d] = v.visit_date?.split("-") ?? [];
        return (
          <li key={v.id}>
            <Link href={`/visits/${v.id}`} className="flex items-center gap-3 py-3 hover:text-pen">
              <span className="w-12 shrink-0 text-center leading-tight tabular-nums">
                {v.visit_date ? (
                  <>
                    <span className="block font-serif text-lg">{d}</span>
                    <span className="block text-xs text-ink-soft">
                      th{Number(m)} · {y}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ink-soft">Chưa rõ ngày</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-medium">{tidyName(v.facility) || "Chưa ghi nơi khám"}</span>
                <span className="muted flex flex-wrap items-center gap-x-2">
                  {showPerson && v.people?.full_name && <span>{v.people.full_name}</span>}
                  {v.cases?.title && (
                    <span className="inline-flex items-center gap-1">
                      <Folder className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {v.cases.title}
                    </span>
                  )}
                  {docCount > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {docCount}
                    </span>
                  )}
                </span>
                {v.reason && <span className="muted line-clamp-1">{v.reason}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
