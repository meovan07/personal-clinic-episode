import { isToolUIPart, type UIMessage } from "ai";

/**
 * After the user answers approval cards, the client sends back the assistant message that asked.
 * The server only takes the answers from it (approved or not, plus an optional reason) and applies
 * them to its own stored copy, so a client can't change a tool's input or approve something that
 * was never asked. Returns null if the message has no pending approval that the client answered.
 */
export function applyApprovalResponses(stored: UIMessage, fromClient: UIMessage): UIMessage | null {
  if (stored.role !== "assistant" || stored.id !== fromClient.id) return null;

  const answers = new Map<string, { approved: boolean; reason?: string }>();
  for (const part of fromClient.parts) {
    if (!isToolUIPart(part) || part.state !== "approval-responded") continue;
    if (typeof part.approval.approved !== "boolean") continue;
    answers.set(part.approval.id, {
      approved: part.approval.approved,
      reason: typeof part.approval.reason === "string" ? part.approval.reason.slice(0, 500) : undefined,
    });
  }

  let answered = 0;
  const parts = stored.parts.map((part) => {
    if (!isToolUIPart(part) || part.state !== "approval-requested" || part.approval.isAutomatic) return part;
    const answer = answers.get(part.approval.id);
    if (!answer) return part;
    answered++;
    return {
      ...part,
      state: "approval-responded" as const,
      approval: { ...part.approval, approved: answer.approved, ...(answer.reason ? { reason: answer.reason } : {}) },
    };
  });
  return answered > 0 ? { ...stored, parts: parts as UIMessage["parts"] } : null;
}
