// Stops the page behind a full-screen panel from scrolling. iOS Safari ignores overflow on <body> alone
// in some cases (notably while the keyboard is open), so <html> is locked too. Returns the undo.
export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const { body } = document;
  const previous = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  return () => {
    [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = previous;
  };
}
