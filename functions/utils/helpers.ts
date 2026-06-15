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

/** Workers 런타임은 UTC — 종일·마감일은 한국 달력 기준으로 처리 */
export const KST_TIMEZONE = "Asia/Seoul";

export function dateKeyKst(ts: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: KST_TIMEZONE }).format(new Date(ts));
}

export function fromDateKeyKst(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00+09:00`).getTime();
}

export function endOfDateKeyKst(dateKey: string): number {
  return new Date(`${dateKey}T23:59:59.999+09:00`).getTime();
}

export function startOfDayKst(ts: number): number {
  return fromDateKeyKst(dateKeyKst(ts));
}

export function endOfDayKst(ts: number): number {
  return endOfDateKeyKst(dateKeyKst(ts));
}

export function allDaySpanKst(ts: number): { dateKey: string; startAt: number; endAt: number } {
  const dateKey = dateKeyKst(ts);
  return {
    dateKey,
    startAt: fromDateKeyKst(dateKey),
    endAt: endOfDateKeyKst(dateKey),
  };
}

export function toDateLocal(ts: number): string {
  return dateKeyKst(ts);
}

export function fromDateLocal(value: string): number {
  return fromDateKeyKst(value);
}

const KST = KST_TIMEZONE;

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

export function formatEventTime(start: number, end: number, allDay: boolean): string {
  if (allDay) return "종일";
  if (!sameDateKst(start, end) && formatClockKst(end) === "00:00") {
    return `${formatClockKst(start)} - 24:00`;
  }
  return `${formatClockKst(start)} - ${formatClockKst(end)}`;
}

/** 알림·이메일 등 서버(Workers)에서 한국 시각으로 표시할 때 사용 */
export function formatEventDateTimeKst(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function formatDateKst(
  ts: number,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, ...options }).format(new Date(ts));
}

/** YYYY. M. D. 형식 (toLocaleDateString ko-KR 대체) */
export function formatDateOnlyKst(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST }).format(new Date(ts));
}

/** 활동 로그·댓글·검색 등 — 6월 11일 오후 3:00 */
export function formatActivityTimeKst(ts: number): string {
  return formatDateKst(ts, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 시각만 — 오후 3:00 */
export function formatTimeKst(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** 날짜+시각 기본 형식 (CSV·AI 프롬프트 등) */
export function formatDateTimeKst(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function sameDateKst(a: number, b: number): boolean {
  return dateKeyKst(a) === dateKeyKst(b);
}
