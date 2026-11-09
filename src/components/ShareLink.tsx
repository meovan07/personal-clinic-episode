"use client";

import { useRef, useState } from "react";
import { Share2 } from "lucide-react";

// Members-only header button: opens the share sheet (or copies) the public link of the current page.
// Installed PWAs have no address bar, so this is the only way to grab the link.
export function ShareLink({ path, title }: { path: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Sao chép liên kết", url);
    }
  }

  async function onClick() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copy(url);
  }

  return (
    <button type="button" className="btn" onClick={onClick} aria-live="polite">
      <Share2 className="h-4 w-4" strokeWidth={1.75} />
      {copied ? "Đã sao chép liên kết" : "Chia sẻ"}
    </button>
  );
}
