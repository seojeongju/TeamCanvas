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

export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

export function fromDateLocal(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

export function isSameCalendarDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** 날짜만 바꾸고 시·분은 유지 */
export function setDateKeepTime(ts: number, target: Date): number {
  const d = new Date(ts);
  d.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
  return d.getTime();
}

/** 다음 정각 + 1시간 기본 종료 */
export function getSmartDefaultRange(prefillDate?: Date): { start: number; end: number } {
  const now = new Date();
  const base = prefillDate ?? now;
  const isToday =
    base.getFullYear() === now.getFullYear() &&
    base.getMonth() === now.getMonth() &&
    base.getDate() === now.getDate();

  const start = new Date(base);
  if (isToday) {
    start.setTime(now.getTime());
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    if (start.getTime() <= now.getTime()) {
      start.setHours(start.getHours() + 1);
    }
  } else {
    start.setHours(9, 0, 0, 0);
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.getTime(), end: end.getTime() };
}

export function formatDurationMinutes(start: number, end: number): string {
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function formatDateChipLabel(date: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "오늘";
  }
  if (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  ) {
    return "내일";
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatRecurrenceRule(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const normalized = rule.toUpperCase();
  if (normalized === "FREQ=DAILY") return "매일";
  if (normalized === "FREQ=WEEKLY") return "매주";
  if (normalized === "FREQ=MONTHLY") return "매월";
  if (normalized === "FREQ=YEARLY") return "매년";
  return rule;
}

export function colorClass(hex: string): string {
  const map: Record<string, string> = {
    "#4A9FE8": "bg-primary-400",
    "#8B5CF6": "bg-violet-400",
    "#10B981": "bg-emerald-400",
    "#F97316": "bg-orange-400",
    "#EC4899": "bg-pink-400",
  };
  return map[hex] ?? "bg-primary-400";
}
