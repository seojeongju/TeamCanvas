import { fromDateLocal, toDateLocal } from "./dates";
import type { CalendarEvent } from "./types";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseExcludedDates(dates: string[] | null | undefined): string[] {
  if (!dates?.length) return [];
  return [...new Set(dates.filter((d) => DATE_KEY_RE.test(d)))].sort();
}

/** 종일 일정 시작일~종료일 사이 모든 날짜 키 */
export function enumerateDateKeysInAllDayRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const start = fromDateLocal(startDate);
  const end = fromDateLocal(endDate);
  if (end < start) return [];

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end) {
    keys.push(toDateLocal(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function isMultiDayAllDayRange(startDate: string, endDate: string): boolean {
  return enumerateDateKeysInAllDayRange(startDate, endDate).length >= 2;
}

/** 기간 밖·시작/종료일 제외 날짜 정리 */
export function pruneExcludedDates(
  excluded: string[],
  startDate: string,
  endDate: string,
): string[] {
  const allowed = new Set(enumerateDateKeysInAllDayRange(startDate, endDate));
  return excluded.filter((d) => allowed.has(d) && d !== startDate && d !== endDate);
}

export function formatExcludedDatesSummary(
  startDate: string,
  endDate: string,
  excluded: string[],
): string | null {
  const pruned = pruneExcludedDates(excluded, startDate, endDate);
  if (pruned.length === 0) return null;

  const total = enumerateDateKeysInAllDayRange(startDate, endDate).length;
  const included = total - pruned.length;
  const labels = pruned.map((d) => {
    const [, m, day] = d.split("-");
    return `${Number(m)}/${Number(day)}`;
  });

  return `${included}일 일정 · ${pruned.length}일 제외 (${labels.join(", ")})`;
}

export function canManageExcludedDates(event: CalendarEvent): boolean {
  if (event.sourceType && event.sourceType !== "event") return false;
  if (!event.allDay) return false;
  return isMultiDayAllDayRange(toDateLocal(event.startAt), toDateLocal(event.endAt));
}
