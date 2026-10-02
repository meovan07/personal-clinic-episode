"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";

type State =
  | { kind: "loading" }
  | { kind: "install-first" } // iPhone/iPad outside the installed app: push isn't available there
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; subscription: PushSubscription };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  );
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Turns the morning reminders on or off for this device (each phone/computer subscribes separately).
// The daily job (/api/reminders) sends to every subscribed device of both members.
export function NotificationSettings() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<State> {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return isIOS() && !isInstalled() ? { kind: "install-first" } : { kind: "unsupported" };
      if (Notification.permission === "denied") return { kind: "blocked" };
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? { kind: "on", subscription } : { kind: "off" };
    }
    detect().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      // Asked straight from the tap: iOS only shows the permission prompt for a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "blocked" } : { kind: "off" });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await savePushSubscription(subscription.toJSON(), navigator.userAgent);
      setState({ kind: "on", subscription });
      const test = await sendTestPush();
      setMessage(test.error ?? "Đã bật. Bạn sẽ nhận một thông báo thử ngay bây giờ.");
    } catch (e) {
      setMessage(`Không bật được thông báo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(subscription: PushSubscription) {
    setBusy(true);
    setMessage(null);
    try {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setState({ kind: "off" });
    } catch (e) {
      setMessage(`Không tắt được: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestPush().catch((e) => ({ sent: 0, error: String(e) }));
    setMessage(result.error ?? "Đã gửi thông báo thử.");
    setBusy(false);
  }

  if (state.kind === "loading") return null;

  const text: Record<Exclude<State["kind"], "loading" | "on" | "off">, string> = {
    "install-first":
      "Để nhận nhắc lịch trên iPhone, hãy cài app vào Màn hình chính (Chia sẻ → Thêm vào Màn hình chính) rồi mở từ biểu tượng đó.",
    unsupported: "Trình duyệt này không hỗ trợ thông báo.",
    blocked: isIOS()
      ? "Thông báo đang bị chặn. Bật lại trong Cài đặt → Thông báo → Bệnh án."
      : "Thông báo đang bị chặn cho trang này. Bật lại trong cài đặt trang của trình duyệt.",
  };

  return (
    <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
      {state.kind === "on" ? (
        <BellRing className="h-5 w-5 shrink-0 text-pine" strokeWidth={1.75} />
      ) : state.kind === "off" ? (
        <Bell className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
      ) : (
        <BellOff className="h-5 w-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
      )}
      <div className="min-w-0 flex-1">
        {state.kind === "on" || state.kind === "off" ? (
          <>
            <p className="font-medium">Nhắc lịch trên thiết bị này: {state.kind === "on" ? "đang bật" : "đang tắt"}</p>
            <p className="text-xs text-ink-soft">
              Mỗi sáng khoảng 8 giờ, việc cần làm và mũi tiêm của hôm nay và ngày mai.
            </p>
          </>
        ) : (
          <p className="text-ink-soft">{text[state.kind]}</p>
        )}
        {message && <p className="mt-1 text-xs text-pen">{message}</p>}
      </div>
      {state.kind === "off" && (
        <button type="button" className="btn-primary" disabled={busy} onClick={turnOn}>
          {busy ? "Đang bật…" : "Bật nhắc lịch"}
        </button>
      )}
      {state.kind === "on" && (
        <div className="flex gap-2">
          <button type="button" className="btn" disabled={busy} onClick={test}>
            Gửi thử
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => turnOff(state.subscription)}>
            Tắt
          </button>
        </div>
      )}
    </div>
  );
}
