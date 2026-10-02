import { z } from "zod";

// A photo/PDF sent in the chat. The browser uploads the files into the inbox (same as the "+" button) and
// the user message carries this part; the assistant reads it with read_document and saves it with
// save_document. Shared by client and server.

export const DocumentAttachment = z.object({
  inbox_id: z.string().uuid(),
  files: z.array(z.string().max(300)).min(1).max(20),
});
export type DocumentAttachment = z.infer<typeof DocumentAttachment>;

export const DATA_SCHEMAS = { document: DocumentAttachment };

/** How the model sees the attachment. */
export function attachmentText(a: DocumentAttachment): string {
  return `[The user attached a document: inbox_id ${a.inbox_id}, ${a.files.length} file(s): ${a.files.join(", ")}]`;
}
