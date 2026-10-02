"use client";

import Link from "next/link";
import type { getToolName } from "ai";
import { ArrowRight, Ban, Check, CircleAlert, PencilLine, Trash2 } from "lucide-react";
import { parsePreview, type ApprovalPreview } from "@/lib/agent/approval";

type ToolPart = Parameters<typeof getToolName>[0];

/** Tool calls that went through the approval step (shown as a card instead of a status line). */
export function isApprovalPart(part: ToolPart): boolean {
  return !!part.approval && (!part.approval.isAutomatic || part.state === "output-denied");
}

function Body({ preview }: { preview: ApprovalPreview }) {
  return (
    <>
      {preview.fields.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {preview.fields.map((f) => (
            <div key={f.label} className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="text-ink-soft">{f.label}</dt>
              <dd className="min-w-0 break-words">
                {"before" in f ? (
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    <span className="text-ink-faint line-through">{f.before ?? "(trống)"}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={2} />
                    <span className="font-medium">{f.after ?? "(trống)"}</span>
                  </span>
                ) : (
                  <span className="font-medium">{f.after}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!!preview.removes?.length && (
        <div className="mt-2">
          <p className="font-medium text-stamp">Xoá luôn:</p>
          <ul className="list-disc pl-5 marker:text-stamp">
            {preview.removes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {!!preview.notes?.length && (
        <ul className="mt-2 space-y-1 rounded-md bg-flag-low-tint px-2.5 py-1.5 text-xs text-flag-low">
          {preview.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {!!preview.keeps?.length && (
        <ul className="mt-2 text-ink-soft">
          {preview.keeps.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// A change the assistant wants to make. The user approves or declines it here; afterwards the card
// stays in the conversation as a record of what was done (or not).
export function ApprovalCard({
  part,
  onAnswer,
  canAnswer,
  onNavigate,
}: {
  part: ToolPart;
  onAnswer: (approvalId: string, approved: boolean) => void;
  canAnswer: boolean;
  onNavigate: () => void;
}) {
  const approval = part.approval!;

  // Denied before the user saw anything (e.g. the record no longer exists): a short note is enough.
  if (approval.isAutomatic) {
    return (
      <div className="flex items-start gap-1.5 text-xs text-ink-soft">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-flag-low" strokeWidth={2} />
        Không thực hiện được{approval.reason ? `: ${approval.reason}` : ""}
      </div>
    );
  }

  const preview = parsePreview(approval.requestReason);
  const destructive = preview?.destructive ?? false;
  const output = part.state === "output-available" ? (part.output as { url?: string } | undefined) : undefined;
  const Icon = destructive ? Trash2 : PencilLine;

  return (
    <div className={`anim-rise rounded-lg border text-sm ${destructive ? "border-stamp/50" : "border-line-strong"}`}>
      <div
        className={`flex items-center gap-2 rounded-t-lg px-3 py-2 font-medium ${
          destructive ? "bg-stamp-tint text-stamp" : "bg-pine-tint text-pine"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">{preview?.title ?? "Thay đổi hồ sơ"}</span>
        {preview?.person && <span className="shrink-0 text-xs font-normal">{preview.person}</span>}
      </div>

      <div className="px-3 py-2">
        {preview?.target && <p className="font-medium">{preview.target}</p>}
        {preview ? <Body preview={preview} /> : <p className="text-ink-soft">Không đọc được nội dung thay đổi.</p>}
        {preview?.link && part.state === "approval-requested" && (
          <Link
            href={preview.link.href}
            onClick={onNavigate}
            className="mt-2 inline-block text-xs text-pen underline underline-offset-2"
          >
            {preview.link.label}
          </Link>
        )}
      </div>

      <div className="border-t border-line px-3 py-2">
        {part.state === "approval-requested" ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" disabled={!canAnswer} onClick={() => onAnswer(approval.id, false)}>
              Không
            </button>
            <button
              type="button"
              className={destructive ? "btn-danger-solid" : "btn-primary"}
              disabled={!canAnswer || !preview}
              onClick={() => onAnswer(approval.id, true)}
            >
              {destructive ? "Xoá" : "Đồng ý"}
            </button>
          </div>
        ) : part.state === "approval-responded" ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            {approval.approved ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-pine" />
                Đang thực hiện…
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" strokeWidth={2} />
                Bạn đã không đồng ý
              </>
            )}
          </p>
        ) : part.state === "output-available" ? (
          <p className="flex items-center gap-1.5 text-xs text-flag-normal">
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            {destructive ? "Đã xoá" : "Đã lưu"}
            {output?.url && (
              <Link href={output.url} onClick={onNavigate} className="ml-auto text-pen underline underline-offset-2">
                Xem
              </Link>
            )}
          </p>
        ) : part.state === "output-denied" ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            <Ban className="h-3.5 w-3.5" strokeWidth={2} />
            Bạn đã không đồng ý
          </p>
        ) : part.state === "output-error" ? (
          <p className="flex items-start gap-1.5 text-xs text-stamp">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Không lưu được: {part.errorText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
