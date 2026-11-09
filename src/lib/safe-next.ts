// Only same-origin relative paths may be used as a post-login destination (open-redirect guard).
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value[1] === "/" || value[1] === "\\") return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  if (/^\/login(?![a-z0-9_-])/i.test(value)) return "/";
  return value;
}
