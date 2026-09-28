import { Badge } from "@/components/Badge";
import { formatDate, today } from "@/lib/format";
import { groupBySeries, type Dose } from "@/lib/vaccinations";

type Row = Dose & { id: string; typically_single_dose?: boolean | null };

// One line per disease/series: how many doses, the most recent date, and the next appointment if still open.
export function VaccinationSummary({ doses }: { doses: Row[] }) {
  if (doses.length === 0) return <p className="muted">Chưa có mũi tiêm nào.</p>;
  const now = today();
  return (
    <ul className="divide-y divide-line">
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
                · {s.doses.length} mũi · gần nhất{" "}
                {last.given_on ? <span className="data">{formatDate(last.given_on)}</span> : "chưa rõ ngày"}
              </span>
            </div>
            {due ? (
              <Badge tone={overdue ? "danger" : "pen"}>
                {overdue ? "Quá hẹn" : "Hẹn"} {formatDate(due)}
              </Badge>
            ) : (
              last.typically_single_dose && <Badge tone="pine">Thường chỉ 1 mũi</Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
