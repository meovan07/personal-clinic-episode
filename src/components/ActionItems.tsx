import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
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
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
                  a.done ? "border-pine bg-pine text-white" : "border-line-strong bg-surface"
                }`}
              >
                {a.done && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </PendingButton>
            </form>
            <div className="flex-1">
              <span className={a.done ? "text-ink-faint line-through" : ""}>{a.content}</span>
              <div className="muted flex flex-wrap gap-x-2 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']">
                {showPerson && a.people && <span>{a.people.full_name}</span>}
                {a.due_on && <span>Hạn {formatDate(a.due_on)}</span>}
                {a.visit_id && !visitId && (
                  <Link href={`/visits/${a.visit_id}`} className="hover:text-pen">
                    xem lần khám
                  </Link>
                )}
              </div>
            </div>
            <form action={deleteActionItem.bind(null, a.id)}>
              <PendingButton className="text-ink-faint hover:text-stamp" aria-label="Xóa">
                <X className="h-4 w-4" strokeWidth={1.75} />
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
          <SubmitButton className="btn">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Thêm
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
