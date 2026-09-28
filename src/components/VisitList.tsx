import Link from "next/link";
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
    <ol className="relative space-y-3 border-l-2 border-teal-100 pl-5">
      {visits.map((v) => {
        const docCount = v.documents?.[0]?.count ?? 0;
        return (
          <li key={v.id} className="relative">
            <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
            <Link href={`/visits/${v.id}`} className="card block hover:border-teal-300">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{formatDate(v.visit_date) || "Chưa rõ ngày"}</span>
                <span className="muted">
                  {showPerson && v.people?.full_name}
                  {docCount > 0 && ` · 📎 ${docCount}`}
                </span>
              </div>
              <div className="text-slate-700">{v.facility ?? "Chưa ghi nơi khám"}</div>
              {v.cases?.title && <div className="mt-1 text-sm text-teal-700">📁 {v.cases.title}</div>}
              {v.reason && <div className="muted mt-1 line-clamp-2">{v.reason}</div>}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
