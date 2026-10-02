const TONE: Record<string, string> = {
  neutral: "bg-paper-dim text-ink-soft",
  pine: "bg-pine-tint text-pine",
  pen: "bg-pen-tint text-pen",
  low: "bg-flag-low-tint text-flag-low",
  danger: "bg-stamp-tint text-stamp",
};

// Small status pill driven by the shared functional tokens - case status, inbox status,
// lab flags and due/overdue badges all read the same way instead of copy-pasted inline styles.
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
