// Dates from Postgres `date` columns arrive as "YYYY-MM-DD"; format without timezone shifts.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function age(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years--;
  return years;
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type DueTone = "danger" | "low" | "neutral";

/** How far a due date is from today, in plain words: "Hôm nay", "Còn 5 ngày", "Quá hạn 7 tháng"… */
export function relativeDue(date: string, todayIso: string): { label: string; tone: DueTone } {
  const d = daysBetween(todayIso, date.slice(0, 10));
  if (d < 0) {
    const late = -d;
    const label =
      late < 30 ? `Quá hạn ${late} ngày` : late < 365 ? `Quá hạn ${Math.round(late / 30)} tháng` : `Quá hạn ${Math.round(late / 365)} năm`;
    return { label, tone: "danger" };
  }
  if (d === 0) return { label: "Hôm nay", tone: "low" };
  if (d === 1) return { label: "Ngày mai", tone: "low" };
  if (d <= 7) return { label: `Còn ${d} ngày`, tone: "low" };
  if (d < 60) return { label: `Còn ${Math.round(d / 7)} tuần`, tone: "neutral" };
  if (d < 365) return { label: `Còn ${Math.round(d / 30)} tháng`, tone: "neutral" };
  return { label: formatDate(date), tone: "neutral" };
}

const VOWEL = /[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

/**
 * Hospital and clinic names are copied as printed, often in capitals ("TRUNG TÂM XÉT NGHIỆM Y KHOA MEDILAB").
 * Shown in normal capitalization; abbreviations without vowels (VNVC, TNHH, BS) stay as they are.
 */
export function tidyName(name: string | null | undefined): string {
  if (!name) return "";
  if (name !== name.toUpperCase()) return name; // already has lowercase: keep the user's/printed form
  return name
    .split(/(\s+|-|;|,)/)
    .map((w) => (!VOWEL.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join("");
}

/** How long ago a past date was: "3 ngày trước", "2 tháng trước"; older dates as dd/mm/yyyy. */
export function relativeAgo(date: string, todayIso: string): string {
  const days = daysBetween(date.slice(0, 10), todayIso);
  if (days <= 0) return "hôm nay";
  if (days < 14) return `${days} ngày trước`;
  if (days < 60) return `${Math.round(days / 7)} tuần trước`;
  if (days < 365) return `${Math.round(days / 30)} tháng trước`;
  return formatDate(date);
}
