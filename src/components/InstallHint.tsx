"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

const DISMISSED_KEY = "installHint.dismissed";

// iPhone/iPad Safari never offers to install a web app by itself, and notifications only work once it is
// installed. So on iOS, outside the installed app, explain the two taps once; it can be dismissed for good.
// Android/desktop Chrome show their own install prompt, so nothing is shown there.
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Private mode: show it; dismissing just won't be remembered.
    }
    // Decided after mount: these checks only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(ios && !installed && !dismissed);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="anim-rise card flex items-start gap-3">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-pine">Cài Sổ bệnh án như một ứng dụng</p>
        <p className="mt-1 text-ink-soft">
          Bấm <Share className="inline h-4 w-4 align-[-3px]" strokeWidth={1.75} aria-label="Chia sẻ" /> ở thanh dưới
          Safari, chọn <SquarePlus className="inline h-4 w-4 align-[-3px]" strokeWidth={1.75} aria-hidden />{" "}
          <span className="font-medium text-ink">Thêm vào Màn hình chính</span>. Mở từ biểu tượng mới để dùng toàn màn
          hình và nhận nhắc lịch.
        </p>
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 text-ink-faint hover:text-ink" aria-label="Ẩn">
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
