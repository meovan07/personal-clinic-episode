"use client";

import { useEffect } from "react";

// Whether a focused element brings up the on-screen keyboard.
function opensKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return (
    el instanceof HTMLInputElement &&
    !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "hidden"].includes(el.type)
  );
}

// App-wide browser plumbing with no UI of its own:
// - registers the service worker (offline page, push notifications);
// - publishes the visible area as --vv-top / --vv-height, because iOS Safari doesn't shrink the page when the
//   keyboard opens: full-screen panels (chat, search) size themselves to it so their header and input stay visible;
// - sets data-keyboard on <html> while a text field has focus on a touch screen, so the bottom tab bar and the
//   "+" button (fixed to the bottom) hide instead of floating over the field being typed in.
export function AppShell() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
        console.warn("service worker registration failed", e);
      });
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
      root.style.setProperty("--vv-height", `${vv.height}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    const root = document.documentElement;
    const onFocusIn = (e: FocusEvent) => {
      if (touch.matches && opensKeyboard(e.target)) root.dataset.keyboard = "open";
    };
    const onFocusOut = () => {
      // Focus may move straight to the next field; check once it has settled.
      requestAnimationFrame(() => {
        if (!opensKeyboard(document.activeElement)) delete root.dataset.keyboard;
      });
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
