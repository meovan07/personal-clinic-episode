"use client";

// Native audio controls on a signed URL (expires after an hour; reload the page for a fresh one).
export function AudioPlayer({ url, title }: { url: string; title?: string }) {
  return (
    <div className="card space-y-2">
      {title && <div className="truncate text-sm font-medium text-ink">{title}</div>}
      <audio controls preload="metadata" src={url} aria-label={title ?? "Bản ghi âm"} className="w-full" />
    </div>
  );
}
