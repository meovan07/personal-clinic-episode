"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

export type NavPerson = { id: string; full_name: string };

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// The app always has exactly two people, so they're persistent tabs (a two-person binder),
// not just entries buried in a home-page grid. Desktop: inline next to the wordmark.
// Mobile: a fixed bottom bar, since there's otherwise no way to jump to a person mid-flow.
export function PersonNav({ people }: { people: NavPerson[] }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const activePersonId = people.find((p) => pathname.startsWith(`/people/${p.id}`))?.id;

  return (
    <>
      <nav className="hidden items-center gap-1 sm:flex">
        <Link
          href="/"
          aria-current={isHome ? "page" : undefined}
          className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
            isHome ? "bg-pine-tint text-pine" : "text-ink-soft hover:bg-paper-dim"
          }`}
        >
          Trang chủ
        </Link>
        {people.map((p) => (
          <Link
            key={p.id}
            href={`/people/${p.id}`}
            aria-current={activePersonId === p.id ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              activePersonId === p.id ? "bg-pine-tint text-pine" : "text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {p.full_name}
          </Link>
        ))}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Điều hướng chính"
      >
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
            isHome ? "text-pine" : "text-ink-faint"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={isHome ? 2.25 : 1.75} />
          Trang chủ
        </Link>
        {people.map((p) => {
          const active = activePersonId === p.id;
          return (
            <Link
              key={p.id}
              href={`/people/${p.id}`}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                active ? "text-pine" : "text-ink-faint"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  active ? "bg-pine text-white" : "bg-paper-dim text-ink-soft"
                }`}
              >
                {initial(p.full_name)}
              </span>
              <span className="max-w-[5rem] truncate">{p.full_name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
