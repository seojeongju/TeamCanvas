export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `org-${Date.now()}`;
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function appUrl(request: Request, env: { APP_URL?: string }): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function formatEventTime(start: number, end: number, allDay: boolean): string {
  if (allDay) return "종일";
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(start)} - ${fmt(end)}`;
}
