"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

// Header link for visitors: sends them to /login and brings them back to the page they were on.
export function LoginLink() {
  const pathname = usePathname();
  const qs = useSearchParams().toString();
  if (pathname.startsWith("/login")) return null;
  const next = encodeURIComponent(pathname + (qs ? "?" + qs : ""));
  return (
    <Link href={`/login?next=${next}`} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
      <LogIn className="h-4 w-4" strokeWidth={1.75} />
      <span>Đăng nhập</span>
    </Link>
  );
}
