import Link from "next/link";
import { addActionItem, deleteActionItem, setActionItemDone } from "@/app/actions";
import { PendingButton } from "@/components/PendingButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/format";

export type ActionItemRow = {
  id: string;
  content: string;
  due_on: string | null;
  done: boolean;
  visit_id: string | null;
  people?: { full_name: string } | null;
};

export function ActionItems({
  items,
  personId,
  visitId,
  showPerson = false,
}: {
  items: ActionItemRow[];
  personId?: string;
  visitId?: string;
  showPerson?: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="muted">Không có việc cần làm.</p>}
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <form action={setActionItemDone.bind(null, a.id, !a.done)}>
              <PendingButton
                aria-label={a.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                  a.done ? "border-teal-600 bg-teal-600 text-white" : "border-slate-400 bg-white"
                }`}
              >
                {a.done && "✓"}
              </PendingButton>
            </form>
            <div className="flex-1">
              <span className={a.done ? "text-slate-400 line-through" : ""}>{a.content}</span>
              <div className="muted flex flex-wrap gap-x-2 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']">
                {showPerson && a.people && <span>{a.people.full_name}</span>}
                {a.due_on && <span>Hạn {formatDate(a.due_on)}</span>}
                {a.visit_id && !visitId && (
                  <Link href={`/visits/${a.visit_id}`} className="hover:text-teal-700">
                    xem lần khám
                  </Link>
                )}
              </div>
            </div>
            <form action={deleteActionItem.bind(null, a.id)}>
              <PendingButton className="text-slate-400 hover:text-red-600" aria-label="Xóa">
                ×
              </PendingButton>
            </form>
          </li>
        ))}
      </ul>
      {personId && (
        <form action={addActionItem} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input type="hidden" name="person_id" value={personId} />
          {visitId && <input type="hidden" name="visit_id" value={visitId} />}
          <input name="content" required placeholder="VD: Giảm cân 3kg, Tái khám…" className="input col-span-2 sm:col-span-1" />
          <input type="date" name="due_on" className="input w-auto" aria-label="Hạn" />
          <SubmitButton className="btn">+ Thêm</SubmitButton>
        </form>
      )}
    </div>
  );
}
