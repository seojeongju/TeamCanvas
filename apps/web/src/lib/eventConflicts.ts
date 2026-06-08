import type { CalendarEvent } from "./types";

/** 시간 범위가 겹치는 일정 목록 (수정 시 자기 자신 제외) */
export function findConflictingEvents(
  events: CalendarEvent[],
  startAt: number,
  endAt: number,
  excludeEventId?: string,
): CalendarEvent[] {
  return events.filter((e) => {
    if (excludeEventId && e.id === excludeEventId) return false;
    return startAt < e.endAt && endAt > e.startAt;
  });
}
