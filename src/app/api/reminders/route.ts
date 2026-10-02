import { createClient } from "@supabase/supabase-js";
import { vietnamToday } from "@/lib/calendar";
import { buildCalendarEvents, type CalendarRows } from "@/lib/calendar-data";
import type { Database } from "@/lib/database.types";
import { pushConfigured, sendPush, type StoredSubscription } from "@/lib/push";
import { morningDigest } from "@/lib/reminders";

// Daily morning reminders (Vercel Cron, vercel.json): to-dos and vaccine doses due today or tomorrow, sent as one
// Web Push notification to every device where a member turned notifications on.
// Runs signed out with no Supabase admin key: public.reminder_feed() returns just what's needed, and only to a
// caller holding CRON_SECRET (its hash is in private.cron_tokens).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!pushConfigured()) return Response.json({ ok: false, error: "VAPID keys missing" }, { status: 500 });

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("reminder_feed", { p_token: secret });
  if (error) {
    console.error("reminder feed failed", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 502 });
  }
  const feed = data as unknown as Omit<CalendarRows, "visits"> & { subscriptions: StoredSubscription[] };

  const today = vietnamToday();
  const message = morningDigest(buildCalendarEvents({ visits: [], ...feed }), today);
  if (!message) return Response.json({ ok: true, today, sent: 0, reason: "nothing due" });

  const results = await Promise.all(feed.subscriptions.map((sub) => sendPush(sub, message)));
  const gone = feed.subscriptions.filter((_, i) => results[i] === "gone");
  for (const sub of gone) {
    await supabase.rpc("forget_push_subscription", { p_token: secret, p_endpoint: sub.endpoint });
  }
  return Response.json({
    ok: true,
    today,
    title: message.title,
    sent: results.filter((r) => r === "sent").length,
    removed: gone.length,
    failed: results.filter((r) => r === "failed").length,
  });
}
