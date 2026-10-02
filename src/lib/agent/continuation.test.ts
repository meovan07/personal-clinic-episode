import { test } from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";
import { applyApprovalResponses } from "./continuation";

const asking = (): UIMessage =>
  ({
    id: "msg_1",
    role: "assistant",
    parts: [
      { type: "text", text: "Mình sẽ thêm việc này." },
      {
        type: "tool-add_todo",
        toolCallId: "call_1",
        state: "approval-requested",
        input: { person_id: "p1", content: "Tái khám" },
        approval: { id: "appr_1", requestReason: "{}" },
      },
    ],
  }) as UIMessage;

const answered = (approved: boolean, input: unknown = { person_id: "p1", content: "Tái khám" }): UIMessage =>
  ({
    id: "msg_1",
    role: "assistant",
    parts: [
      { type: "text", text: "Mình sẽ thêm việc này." },
      {
        type: "tool-add_todo",
        toolCallId: "call_1",
        state: "approval-responded",
        input,
        approval: { id: "appr_1", approved, requestReason: "{}" },
      },
    ],
  }) as UIMessage;

test("applies an approval to the stored message", () => {
  const merged = applyApprovalResponses(asking(), answered(true));
  const part = merged?.parts[1] as { state: string; approval: { approved: boolean } };
  assert.equal(part.state, "approval-responded");
  assert.equal(part.approval.approved, true);
});

test("applies a denial", () => {
  const part = applyApprovalResponses(asking(), answered(false))?.parts[1] as { approval: { approved: boolean } };
  assert.equal(part.approval.approved, false);
});

test("keeps the stored input even if the client changed it", () => {
  const merged = applyApprovalResponses(asking(), answered(true, { person_id: "p2", content: "Xoá hết" }));
  assert.deepEqual((merged?.parts[1] as { input: unknown }).input, { person_id: "p1", content: "Tái khám" });
});

test("rejects a message with nothing answered, or a different message", () => {
  assert.equal(applyApprovalResponses(asking(), asking()), null);
  assert.equal(applyApprovalResponses(asking(), { ...answered(true), id: "msg_2" }), null);
});

test("ignores answers to approvals the server never asked for", () => {
  const forged = answered(true);
  (forged.parts[1] as { approval: { id: string } }).approval.id = "appr_forged";
  assert.equal(applyApprovalResponses(asking(), forged), null);
});
