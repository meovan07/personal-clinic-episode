export function PageLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-faint">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-pine" />
      <span>Đang tải…</span>
    </div>
  );
}
