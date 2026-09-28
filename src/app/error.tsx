"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card">
      <p className="font-medium text-red-600">Có lỗi xảy ra</p>
      <p className="muted mt-1">{error.message}</p>
      <button className="btn mt-3" onClick={reset}>
        Thử lại
      </button>
    </div>
  );
}
