import { toDateLocal } from "./dates";
import type { CalendarEvent } from "./types";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

const MAX_OCCURRENCES = 366;
const MAX_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;

export function parseRecurrenceFreq(rule: string | null | undefined): RecurrenceFreq | null {
  if (!rule) return null;
  const match = rule.toUpperCase().match(/FREQ=(DAILY|WEEKLY|MONTHLY)/);
  return (match?.[1] as RecurrenceFreq | undefined) ?? null;
}

function advanceOccurrenceStart(startAt: number, freq: RecurrenceFreq): number {
  const d = new Date(startAt);
  if (freq === "DAILY") d.setDate(d.getDate() + 1);
  else if (freq === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

function occurrenceOverlapsRange(startAt: number, endAt: number, rangeStart: number, rangeEnd: number): boolean {
  return startAt < rangeEnd && endAt > rangeStart;
}

function buildOccurrenceEvent(master: CalendarEvent, occStart: number, occEnd: number): CalendarEvent {
  const dateKey = toDateLocal(occStart);
  return {
    ...master,
    id: `${master.id}::${dateKey}`,
    parentEventId: master.id,
    occurrenceDate: dateKey,
    occurrenceStartAt: occStart,
    startAt: occStart,
    endAt: occEnd,
    isRecurrenceOccurrence: true,
  };
}

/** 반복 일정을 뷰 범위 내 occurrence 목록으로 확장 */
export function expandRecurrence(
  event: CalendarEvent,
  rangeStart: number,
  rangeEnd: number,
): CalendarEvent[] {
  const freq = parseRecurrenceFreq(event.recurrenceRule);
  if (!freq || event.sourceType === "google" || event.id.startsWith("task-due:")) {
    return [event];
  }

  const duration = event.endAt - event.startAt;
  const excluded = new Set(event.excludedDates ?? []);
  const horizonEnd = Math.min(rangeEnd, event.startAt + MAX_HORIZON_MS);
  const results: CalendarEvent[] = [];

  let cursor = event.startAt;
  let count = 0;

  while (cursor <= horizonEnd && count < MAX_OCCURRENCES) {
    const occEnd = cursor + duration;
    if (occurrenceOverlapsRange(cursor, occEnd, rangeStart, rangeEnd)) {
      const dateKey = toDateLocal(cursor);
      if (!excluded.has(dateKey)) {
        results.push(buildOccurrenceEvent(event, cursor, occEnd));
      }
    }
    const next = advanceOccurrenceStart(cursor, freq);
    if (next <= cursor) break;
    cursor = next;
    count++;
  }

  return results.length > 0 ? results : [];
}

/** 캘린더 이벤트 목록에 반복 확장 적용 */
export function expandCalendarEvents(
  events: CalendarEvent[],
  rangeStart: number,
  rangeEnd: number,
): CalendarEvent[] {
  const expanded: CalendarEvent[] = [];

  for (const event of events) {
    if (parseRecurrenceFreq(event.recurrenceRule)) {
      expanded.push(...expandRecurrence(event, rangeStart, rangeEnd));
    } else if (occurrenceOverlapsRange(event.startAt, event.endAt, rangeStart, rangeEnd)) {
      expanded.push(event);
    }
  }

  return expanded.sort((a, b) => a.startAt - b.startAt);
}

/** 반복 일정 리마인더용 occurrence 시작 시각 목록 */
export function recurrenceOccurrenceStarts(
  startAt: number,
  recurrenceRule: string | null | undefined,
  excludedDates: string[] | undefined,
  fromTs: number,
  toTs: number,
): number[] {
  const freq = parseRecurrenceFreq(recurrenceRule);
  if (!freq) return startAt >= fromTs && startAt <= toTs ? [startAt] : [];

  const excluded = new Set(excludedDates ?? []);
  const starts: number[] = [];
  let cursor = startAt;
  let count = 0;
  const horizonEnd = Math.min(toTs, startAt + MAX_HORIZON_MS);

  while (cursor <= horizonEnd && count < MAX_OCCURRENCES) {
    const dateKey = toDateLocal(cursor);
    if (cursor >= fromTs && cursor <= toTs && !excluded.has(dateKey)) {
      starts.push(cursor);
    }
    const next = advanceOccurrenceStart(cursor, freq);
    if (next <= cursor) break;
    cursor = next;
    count++;
  }

  return starts;
}

/** occurrence 클릭 시 부모 일정 ID */
export function resolveParentEventId(event: CalendarEvent): string {
  return event.parentEventId ?? event.id.split("::")[0] ?? event.id;
}
