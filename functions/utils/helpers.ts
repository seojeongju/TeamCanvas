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

export function toDateLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateLocal(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

const KST = "Asia/Seoul";

function formatClockKst(ts: number): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dateKeyKst(ts: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: KST }).format(new Date(ts));
}

export function formatEventTime(start: number, end: number, allDay: boolean): string {
  if (allDay) return "종일";
  if (!sameDateKst(start, end) && formatClockKst(end) === "00:00") {
    return `${formatClockKst(start)} - 24:00`;
  }
  return `${formatClockKst(start)} - ${formatClockKst(end)}`;
}

function sameDateKst(a: number, b: number): boolean {
  return dateKeyKst(a) === dateKeyKst(b);
}
