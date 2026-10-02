import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { addActionItem, deleteActionItem, setActionItemDone } from "@/app/actions";
import { DueChip } from "@/components/DueChip";
import { EditActionItem } from "@/components/EditActionItem";
import { MoreMenu } from "@/components/MoreMenu";
import { PendingButton } from "@/components/PendingButton";
import { Sheet } from "@/components/Sheet";
import { SubmitButton } from "@/components/SubmitButton";
import { vietnamToday } from "@/lib/calendar";

export type ActionItemRow = {
  id: string;
  content: string;
  due_on: string | null;
  done: boolean;
  visit_id: string | null;
  notes?: string | null;
  people?: { full_name: string } | null;
};

// To-dos as quiet rows: tick on the left, the due date as plain words on the right, edit/delete behind "⋯".
// With personId, a "+ Thêm việc" button opens the add form in a sheet instead of keeping it open on the page.
export function ActionItems({
  items,
  personId,
  visitId,
  showPerson = false,
  empty = "Không có việc cần làm.",
}: {
  items: ActionItemRow[];
  personId?: string;
  visitId?: string;
  showPerson?: boolean;
  empty?: string;
}) {
  const today = vietnamToday();
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="muted">{empty}</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <form action={setActionItemDone.bind(null, a.id, !a.done)}>
                <PendingButton
                  aria-label={a.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    a.done
                      ? "border-pine bg-pine text-on-pine hover:bg-pine-dark"
                      : "border-line-strong bg-paper hover:border-pine"
                  }`}
                >
                  {a.done && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </PendingButton>
              </form>
              <div className="min-w-0 flex-1">
                <div className={a.done ? "text-ink-faint line-through" : ""}>{a.content}</div>
                {(showPerson || (a.visit_id && !visitId)) && (
                  <div className="muted flex flex-wrap gap-x-2 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']">
                    {showPerson && a.people && <span>{a.people.full_name}</span>}
                    {a.visit_id && !visitId && (
                      <Link href={`/visits/${a.visit_id}`} className="hover:text-pen">
                        xem lần khám
                      </Link>
                    )}
                  </div>
                )}
              </div>
              {a.due_on && !a.done && <DueChip date={a.due_on} today={today} />}
              <MoreMenu>
                <EditActionItem id={a.id} content={a.content} dueOn={a.due_on} notes={a.notes ?? null} asMenuItem />
                <form action={deleteActionItem.bind(null, a.id)}>
                  <PendingButton className="menu-item text-stamp">
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    Xóa
                  </PendingButton>
                </form>
              </MoreMenu>
            </li>
          ))}
        </ul>
      )}
      {personId && (
        <Sheet
          title="Thêm việc cần làm"
          trigger={
            <>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Thêm việc
            </>
          }
        >
          <form action={addActionItem} className="space-y-3">
            <input type="hidden" name="person_id" value={personId} />
            {visitId && <input type="hidden" name="visit_id" value={visitId} />}
            <label className="block">
              <span className="label">Việc cần làm</span>
              <input name="content" required placeholder="Tái khám, giảm cân 3kg…" className="input" />
            </label>
            <label className="block">
              <span className="label">Hạn (nếu có)</span>
              <input type="date" name="due_on" className="input" />
            </label>
            <SubmitButton className="btn-primary w-full">Thêm</SubmitButton>
          </form>
        </Sheet>
      )}
    </div>
  );
}
