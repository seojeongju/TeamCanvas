import { endOfDay, startOfDay } from "./helpers";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDateLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseExcludedDatesJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d): d is string => typeof d === "string" && DATE_KEY_RE.test(d))
      .sort();
  } catch {
    return [];
  }
}

export function enumerateCalendarDaysInRange(startAt: number, endAt: number): string[] {
  const keys: string[] = [];
  let cursor = startOfDay(startAt);
  const end = startOfDay(endAt);
  while (cursor <= end) {
    keys.push(toDateLocal(cursor));
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    cursor = startOfDay(next.getTime());
  }
  return keys;
}

export function validateExcludedDates(
  dates: string[] | undefined,
  startAt: number,
  endAt: number,
): { ok: true; json: string | null } | { ok: false; error: string } {
  if (!dates?.length) return { ok: true, json: null };

  const rangeKeys = enumerateCalendarDaysInRange(startAt, endAt);
  const rangeSet = new Set(rangeKeys);
  const startKey = rangeKeys[0];
  const endKey = rangeKeys[rangeKeys.length - 1];
  const unique = [...new Set(dates)];

  for (const d of unique) {
    if (!DATE_KEY_RE.test(d)) {
      return { ok: false, error: "제외 날짜 형식이 올바르지 않습니다." };
    }
    if (!rangeSet.has(d)) {
      return { ok: false, error: "제외 날짜는 일정 기간 안에 있어야 합니다." };
    }
    if (d === startKey || d === endKey) {
      return { ok: false, error: "시작일과 종료일은 제외할 수 없습니다." };
    }
  }

  return { ok: true, json: JSON.stringify(unique.sort()) };
}
