import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <p className="font-medium">Không tìm thấy trang này.</p>
      <Link href="/" className="btn mt-3">
        Về trang chủ
      </Link>
    </div>
  );
}
