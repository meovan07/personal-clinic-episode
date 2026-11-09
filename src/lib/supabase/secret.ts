// Server-only: this is the only module that reads SUPABASE_SECRET_KEY. Never import it from client code.
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("src/lib/supabase/secret.ts must only be imported on the server");
}

// Downloads one file from the "documents" bucket with the secret key (bypasses storage RLS).
// Callers must have already checked, as the requesting user, that this path may be served.
export async function downloadDocumentFile(path: string): Promise<Blob | null> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error) throw error;
  return data;
}
