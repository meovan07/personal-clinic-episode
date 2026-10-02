import Link from "next/link";

// Pill tabs that are plain links (?tab=…), so each tab is a real URL the back button and reload respect.
export function Tabs({ tabs, active }: { tabs: { id: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Mục">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          scroll={false}
          aria-current={t.id === active ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            t.id === active ? "bg-pine text-on-pine" : "bg-surface text-ink-soft hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
