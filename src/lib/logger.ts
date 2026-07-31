const SENSITIVE = /password|secret|token|cookie|authorization|access.?key|database.?url/i;
function sanitize(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message.replace(/[A-Za-z]+:\/\/[^\s]+/g, "[URL_REMOVIDA]") };
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? "[REDACTED]" : sanitize(item)]));
  return typeof value === "string" ? value.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]") : value;
}
export function log(level: "info" | "warn" | "error", event: string, context: Record<string, unknown> = {}) {
  const payload = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(context) as object });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(payload);
}
