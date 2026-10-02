// What an approval card shows. The server computes it when the assistant asks to change something
// (from the tool input plus the rows as they are now) and sends it as the approval request's reason;
// the chat panel renders it. Shared by server and client, so no server imports here.

export type ApprovalField = {
  label: string;
  /** Current value, for updates. Absent for creates. */
  before?: string | null;
  after: string | null;
};

export type ApprovalPreview = {
  /** e.g. "Thêm lần khám", "Xoá thuốc". */
  title: string;
  destructive: boolean;
  /** Who the record belongs to. */
  person?: string | null;
  /** The record being changed or removed, e.g. "Lần khám 26/09/2026 · Medilab". */
  target?: string | null;
  fields: ApprovalField[];
  /** Everything else a delete removes with it. */
  removes?: string[];
  /** What a delete leaves in place, e.g. visits that only leave the bệnh án. */
  keeps?: string[];
  /** Things to double-check, e.g. parts of a document the AI couldn't read well. */
  notes?: string[];
  /** Where to see or edit the full details instead. */
  link?: { href: string; label: string };
};

export function parsePreview(reason: string | undefined): ApprovalPreview | null {
  if (!reason) return null;
  try {
    const p = JSON.parse(reason) as ApprovalPreview;
    return typeof p?.title === "string" && Array.isArray(p.fields) ? p : null;
  } catch {
    return null;
  }
}
