import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Supabase pauses free-plan projects after about a week without activity, and this app isn't used every day.
// A daily Vercel Cron job (vercel.json) calls this route, which makes one small request to the database.
// It runs signed out, so row-level security returns nothing; the request itself is what counts as activity.
export async function GET(request: Request) {
  // Vercel sends "Bearer <CRON_SECRET>" when that variable is set on the project; then nobody else can trigger it.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await supabase.from("test_catalog").select("code", { head: true, count: "exact" });
  if (error) {
    console.error("keep-alive failed", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 502 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
