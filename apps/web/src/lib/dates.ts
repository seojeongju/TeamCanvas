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

/** 종일 일정의 마지막 포함 날짜 (YYYY-MM-DD). UTC endOfDay 타임존 넘침 보정 */
export function getAllDayInclusiveEndKey(startAt: number, endAt: number): string {
  const startKey = toDateLocal(startAt);
  let endKey = toDateLocal(endAt);

  const endDate = new Date(endAt);
  const midnight = new Date(endDate);
  midnight.setHours(0, 0, 0, 0);
  if (endAt === midnight.getTime() && endKey > startKey) {
    const last = new Date(midnight);
    last.setDate(last.getDate() - 1);
    return toDateLocal(last.getTime());
  }

  if (endKey > startKey && endAt - startAt <= 86400000) {
    return startKey;
  }

  return endKey;
}

export function eventIncludesCalendarDay(
  event: { startAt: number; endAt: number; allDay?: boolean; excludedDates?: string[] },
  day: Date,
): boolean {
  const dayKey = toDateLocal(day.getTime());
  if ((event.excludedDates ?? []).includes(dayKey)) return false;

  if (event.allDay) {
    const startKey = toDateLocal(event.startAt);
    const endKey = getAllDayInclusiveEndKey(event.startAt, event.endAt);
    return dayKey >= startKey && dayKey <= endKey;
  }

  const from = startOfDay(day.getTime());
  const to = endOfDay(day.getTime());
  return event.startAt < to && event.endAt > from;
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

function applyWorkStart(date: Date, workStart?: string): void {
  if (workStart && /^([01]\d|2[0-3]):([0-5]\d)$/.test(workStart)) {
    const [h, m] = workStart.split(":").map(Number);
    date.setHours(h, m, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }
}

/** 다음 정각 + 1시간 기본 종료 (조직 근무시간 반영) */
export function getSmartDefaultRange(
  prefillDate?: Date,
  workHours?: { start: string; end: string },
): { start: number; end: number } {
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
    applyWorkStart(start, workHours?.start);
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

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatEventDateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`;
}

/** 일정 목록·상세용 시간 범위 (브라우저 로컬 타임존) */
export function formatEventTimeRange(
  startAt: number,
  endAt: number,
  allDay?: boolean,
): string {
  if (allDay) return "종일";
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${fmt(startAt)} - ${fmt(endAt)}`;
}

export function formatEventTimePill(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 || 12;
  return `${period} ${hour12}:${String(m).padStart(2, "0")}`;
}

export type TimeWheelParts = {
  period: "오전" | "오후";
  hour12: number;
  minute: number;
};

export function timePartsFromTimestamp(ts: number): TimeWheelParts {
  const d = new Date(ts);
  const h = d.getHours();
  return {
    period: h < 12 ? "오전" : "오후",
    hour12: h % 12 || 12,
    minute: d.getMinutes(),
  };
}

export function timestampFromTimeParts(
  dateTs: number,
  { period, hour12, minute }: TimeWheelParts,
): number {
  const d = new Date(dateTs);
  let hour24 = hour12 % 12;
  if (period === "오후") hour24 += 12;
  d.setHours(hour24, minute, 0, 0);
  return d.getTime();
}

export function snapMinuteToStep(minute: number, step = 5): number {
  const snapped = Math.round(minute / step) * step;
  return snapped === 60 ? 0 : snapped;
}

export function nearestMinuteStep(minute: number, step = 5): number {
  const options = Array.from({ length: 60 / step }, (_, i) => i * step);
  return options.reduce(
    (best, m) => (Math.abs(m - minute) < Math.abs(best - minute) ? m : best),
    0,
  );
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
    "#EF4444": "bg-red-400",
    "#EC4899": "bg-pink-400",
    "#EA4335": "bg-red-500",
  };
  return map[hex] ?? "bg-primary-400";
}
