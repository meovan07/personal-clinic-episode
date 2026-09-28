export function PageLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
      <span>Đang tải…</span>
    </div>
  );
}
