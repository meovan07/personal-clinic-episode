import { createClient } from "@/lib/supabase/server";
import { downloadDocumentFile } from "@/lib/supabase/secret";
import { fileResponseInit, isUuid } from "@/lib/public-file";

// Streams one document file to anyone, but only if the public_file RPC (run as the caller) says it is public.
// The storage path comes from the database, never from the request.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_file", { p_id: id });
  if (error) {
    console.error("public-file rpc failed", error.message);
    return new Response("Not found", { status: 404 });
  }

  const init = fileResponseInit(data);
  if (init.status !== 200) return new Response("Not found", { status: 404 });

  try {
    const blob = await downloadDocumentFile(init.path);
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, { headers: init.headers });
  } catch (e) {
    console.error("public-file download failed", e instanceof Error ? e.message : String(e));
    return new Response("Not found", { status: 404 });
  }
}
