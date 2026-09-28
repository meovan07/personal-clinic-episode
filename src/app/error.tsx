"use client";

import { TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card flex items-start gap-3">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-stamp" strokeWidth={1.75} />
      <div>
        <p className="font-medium text-stamp">Có lỗi xảy ra</p>
        <p className="muted mt-1">{error.message}</p>
        <button className="btn mt-3" onClick={reset}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
