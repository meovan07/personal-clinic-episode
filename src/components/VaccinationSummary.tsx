import { formatDate, today } from "@/lib/format";
import { groupBySeries, type Dose } from "@/lib/vaccinations";

// One line per disease/series: how many doses, the most recent date, and the next appointment if still open.
export function VaccinationSummary({ doses }: { doses: (Dose & { id: string })[] }) {
  if (doses.length === 0) return <p className="muted">Chưa có mũi tiêm nào.</p>;
  const now = today();
  return (
    <ul className="divide-y divide-slate-100">
      {groupBySeries(doses).map((s) => {
        const last = s.doses.at(-1)!;
        const due = last.next_due_on;
        const overdue = !!due && due < now;
        return (
          <li key={s.key} className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="font-medium">{s.title}</span>
              <span className="muted">
                {" "}
                · {s.doses.length} mũi · gần nhất {formatDate(last.given_on) || "chưa rõ ngày"}
              </span>
            </div>
            {due && (
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                  overdue ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-800"
                }`}
              >
                {overdue ? "Quá hẹn" : "Hẹn"} {formatDate(due)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
