import Link from "next/link";
import { Folder, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/format";

export type VisitRow = {
  id: string;
  visit_date: string | null;
  facility: string | null;
  reason: string | null;
  cases?: { title: string } | null;
  people?: { full_name: string } | null;
  documents?: { count: number }[];
};

export function VisitList({ visits, showPerson = false }: { visits: VisitRow[]; showPerson?: boolean }) {
  if (visits.length === 0) return <p className="muted">Chưa có lần khám nào.</p>;
  return (
    <ol className="relative space-y-3 border-l-2 border-line pl-5">
      {visits.map((v) => {
        const docCount = v.documents?.[0]?.count ?? 0;
        return (
          <li key={v.id} className="relative">
            <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-paper bg-pine" />
            <Link href={`/visits/${v.id}`} className="card card-interactive block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {v.visit_date ? <span className="data">{formatDate(v.visit_date)}</span> : "Chưa rõ ngày"}
                </span>
                <span className="muted flex items-center gap-1">
                  {showPerson && v.people?.full_name}
                  {docCount > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {docCount}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-ink">{v.facility ?? "Chưa ghi nơi khám"}</div>
              {v.cases?.title && (
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-pen">
                  <Folder className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {v.cases.title}
                </div>
              )}
              {v.reason && <div className="muted mt-1 line-clamp-2">{v.reason}</div>}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
