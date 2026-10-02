import { Badge } from "@/components/Badge";
import { relativeDue } from "@/lib/format";

const TONE = { danger: "danger", low: "low", neutral: "neutral" } as const;

/** "Quá hạn 8 tháng" in red, "Còn 5 ngày" in amber, further dates in grey. */
export function DueChip({ date, today }: { date: string; today: string }) {
  const due = relativeDue(date, today);
  return <Badge tone={TONE[due.tone]}>{due.label}</Badge>;
}
