// Which routes a signed-out visitor may open (spec R1). Pure so the proxy and the tests share it.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PERSON = new RegExp(`^/people/${UUID}$`, "i");
const OPEN = [
  new RegExp(`^/visits/${UUID}$`, "i"),
  new RegExp(`^/cases/${UUID}$`, "i"),
  new RegExp(`^/api/public-file/${UUID}$`, "i"),
];
// Chỉ số and Tiêm chủng stay members-only; any other tab value renders Tổng quan.
const LOCKED_TABS = new Set(["chi-so", "tiem-chung"]);

export function isPublicPath(pathname: string, search: string | URLSearchParams): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (OPEN.some((re) => re.test(path))) return true;
  if (!PERSON.test(path)) return false;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return !LOCKED_TABS.has(params.get("tab") ?? "");
}
