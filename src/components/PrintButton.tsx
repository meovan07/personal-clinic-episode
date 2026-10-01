"use client";

import { Printer } from "lucide-react";

// Browsers offer "Save as PDF" in the same print dialog, so one button covers both.
export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" strokeWidth={1.75} />
      In / Lưu PDF
    </button>
  );
}
