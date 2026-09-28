import { Badge } from "@/components/Badge";
import { formatDate, today } from "@/lib/format";

export type UpcomingDose = { id: string; vaccine_name: string; disease: string | null; next_due_on: string };

// Next-dose appointments that no later dose has covered yet (see pendingDoses), overdue ones highlighted.
export function UpcomingDoses({ doses }: { doses: UpcomingDose[] }) {
  if (doses.length === 0) return <p className="muted">Không có mũi nào đang hẹn.</p>;
  const now = today();
  return (
    <ul className="divide-y divide-line">
      {doses.map((d) => {
        const overdue = d.next_due_on < now;
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="font-medium">{d.disease ?? d.vaccine_name}</span>
              {d.disease && <span className="muted"> · {d.vaccine_name}</span>}
            </div>
            <Badge tone={overdue ? "danger" : "pen"}>
              {overdue ? "Quá hẹn" : "Hẹn"} <span className="data">{formatDate(d.next_due_on)}</span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
