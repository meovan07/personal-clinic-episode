import webpush from "web-push";
import type { PushMessage } from "@/lib/reminders";

// Sends Web Push notifications (server only). The browser side lives in NotificationSettings.tsx and public/sw.js.
// VAPID keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (see docs/development.md). The subject tells push
// services who to contact about these messages; the site URL is used so no personal email is sent along.

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "sent" | "gone" | "failed";

let configured = false;

export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setup() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://personal-clinic-episode.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/** "gone" means the device unsubscribed or the app was removed; the subscription should be deleted. */
export async function sendPush(sub: StoredSubscription, message: PushMessage): Promise<PushResult> {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message),
      // A reminder that couldn't be delivered within a day is stale.
      { TTL: 24 * 60 * 60, urgency: "normal" },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("push failed", status, e instanceof Error ? e.message : e);
    return "failed";
  }
}
