"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// A small top progress bar so navigation feels responsive even when a page
// has to fetch data before it can render (no client router cache hit yet).
export function TopLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [seenPathname, setSeenPathname] = useState(pathname);

  // The path just changed, so whatever navigation was pending has landed - this is
  // React's documented pattern for adjusting state during render instead of an effect.
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setVisible(false);
  }

  useEffect(() => {
    // Scoped to this pathname's effect run, so it's cleared automatically (via the
    // cleanup below) the moment navigation lands and a new effect run replaces it.
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement).closest("a");
      if (!link || link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || href === pathname || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
      // Small delay so already-prefetched (instant) navigations never flash the bar.
      timer = setTimeout(() => setVisible(true), 100);
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  if (!visible) return null;
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-pine-tint">
      <div className="h-full w-1/3 animate-[top-loader_1s_ease-in-out_infinite] bg-pine" />
    </div>
  );
}
