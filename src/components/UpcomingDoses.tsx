import { formatDate, today } from "@/lib/format";

export type UpcomingDose = { id: string; vaccine_name: string; disease: string | null; next_due_on: string };

// Next-dose appointments that no later dose has covered yet (see pendingDoses), overdue ones highlighted.
export function UpcomingDoses({ doses }: { doses: UpcomingDose[] }) {
  if (doses.length === 0) return <p className="muted">Không có mũi nào đang hẹn.</p>;
  const now = today();
  return (
    <ul className="divide-y divide-slate-100">
      {doses.map((d) => {
        const overdue = d.next_due_on < now;
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <span className="font-medium">{d.disease ?? d.vaccine_name}</span>
              {d.disease && <span className="muted"> · {d.vaccine_name}</span>}
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                overdue ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-800"
              }`}
            >
              {overdue ? "Quá hẹn" : "Hẹn"} {formatDate(d.next_due_on)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
