// Pure helpers for the public file route (no Supabase imports, so they can be unit tested).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export type FileResponseInit =
  | { status: 404 }
  | { status: 200; headers: Record<string, string>; path: string };

// Turns the row returned by the public_file RPC ({ storage_path, mime_type } or null) into a response plan.
// Indexing is allowed (R10), so there is deliberately no X-Robots-Tag.
export function fileResponseInit(row: unknown): FileResponseInit {
  if (typeof row !== "object" || row === null) return { status: 404 };
  const { storage_path, mime_type } = row as { storage_path?: unknown; mime_type?: unknown };
  if (typeof storage_path !== "string" || storage_path === "") return { status: 404 };
  return {
    status: 200,
    path: storage_path,
    headers: {
      "Content-Type": typeof mime_type === "string" && mime_type !== "" ? mime_type : "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  };
}
