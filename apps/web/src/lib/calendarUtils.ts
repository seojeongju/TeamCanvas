import {
  endOfDay,
  eventIncludesCalendarDay,
  isSameCalendarDay,
  startOfDay,
  toDateLocal,
} from "./dates";
import type { CalendarEvent } from "./types";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

export const AGENDA_DAYS = 14;

export const HOUR_START = 6;
export const HOUR_END = 22;
export const SLOT_MINUTES = 30;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;

export function getSlotsCount(): number {
  return (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
}

export function addDaysToDate(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDaysToDate(start, i));
}

export function slotIndexToTimestamp(day: Date, slotIndex: number): number {
  const d = new Date(day);
  d.setHours(HOUR_START, 0, 0, 0);
  d.setMinutes(d.getMinutes() + slotIndex * SLOT_MINUTES);
  return d.getTime();
}

export function timestampToSlotIndex(ts: number, day: Date): number {
  const d = new Date(ts);
  const dayStart = new Date(day);
  dayStart.setHours(HOUR_START, 0, 0, 0);
  const diffMinutes = (d.getTime() - dayStart.getTime()) / 60000;
  return Math.max(0, Math.min(getSlotsCount() - 1, Math.floor(diffMinutes / SLOT_MINUTES)));
}

export function formatHourLabel(hour: number): string {
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return "오후 12시";
  return `오후 ${hour - 12}시`;
}

export function getViewRange(viewMode: CalendarViewMode, focusDate: Date): { from: number; to: number } {
  if (viewMode === "agenda") {
    const from = startOfDay(focusDate.getTime());
    const end = addDaysToDate(focusDate, AGENDA_DAYS - 1);
    return { from, to: endOfDay(end.getTime()) };
  }
  if (viewMode === "day") {
    return { from: startOfDay(focusDate.getTime()), to: endOfDay(focusDate.getTime()) };
  }
  if (viewMode === "week") {
    const weekStart = startOfWeek(focusDate);
    const weekEnd = addDaysToDate(weekStart, 6);
    return { from: startOfDay(weekStart.getTime()), to: endOfDay(weekEnd.getTime()) };
  }
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const monthEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
  return { from: startOfDay(monthStart.getTime()), to: endOfDay(monthEnd.getTime()) };
}

export function eventsForDay<
  T extends { startAt: number; endAt: number; allDay?: boolean; excludedDates?: string[] },
>(events: T[], day: Date): T[] {
  return events.filter((e) => eventIncludesCalendarDay(e, day));
}

export function eventBlockStyle(
  startAt: number,
  endAt: number,
  day: Date,
  slotHeightPx: number,
): { top: number; height: number } {
  const startSlot = timestampToSlotIndex(startAt, day);
  const endSlot = Math.max(startSlot + 1, timestampToSlotIndex(endAt, day) + 1);
  return {
    top: startSlot * slotHeightPx,
    height: Math.max(slotHeightPx, (endSlot - startSlot) * slotHeightPx),
  };
}

/** 월간 그리드용 주 단위 날짜 배열 (앞뒤 달 패딩 포함) */
export function getMonthWeeks(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const monthEnd = new Date(year, month + 1, 0);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - monthEnd.getDay()));

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** 종일·멀티데이 일정은 월간 뷰에서 가로 막대로 표시 */
export function isSpanningBarEvent(event: CalendarEvent): boolean {
  if (event.allDay) return true;
  return !isSameCalendarDay(event.startAt, event.endAt);
}

export type MonthBarSegment = {
  event: CalendarEvent;
  weekIndex: number;
  startCol: number;
  span: number;
  lane: number;
  showTitle: boolean;
  roundLeft: boolean;
  roundRight: boolean;
};

function rangesOverlap(aStart: number, aSpan: number, bStart: number, bSpan: number): boolean {
  return aStart < bStart + bSpan && bStart < aStart + aSpan;
}

function eventStartColInWeek(event: CalendarEvent, week: Date[]): number {
  for (let i = 0; i < week.length; i++) {
    const from = startOfDay(week[i].getTime());
    const to = endOfDay(week[i].getTime());
    if (event.startAt >= from && event.startAt <= to) return i;
  }
  return 0;
}

function dayIncludedInEvent(event: CalendarEvent, week: Date[], col: number): boolean {
  return eventIncludesCalendarDay(event, week[col]);
}

function hasIncludedDayBefore(event: CalendarEvent, week: Date[], col: number): boolean {
  if (col > 0) return dayIncludedInEvent(event, week, col - 1);
  const prev = new Date(week[0]);
  prev.setDate(prev.getDate() - 1);
  return eventIncludesCalendarDay(event, prev);
}

function hasIncludedDayAfter(event: CalendarEvent, week: Date[], col: number): boolean {
  if (col < 6) return dayIncludedInEvent(event, week, col + 1);
  const next = new Date(week[6]);
  next.setDate(next.getDate() + 1);
  return eventIncludesCalendarDay(event, next);
}

function barRunsInWeek(event: CalendarEvent, week: Date[]): { startCol: number; endCol: number }[] {
  const runs: { startCol: number; endCol: number }[] = [];
  let runStart = -1;

  for (let i = 0; i < 7; i++) {
    if (dayIncludedInEvent(event, week, i)) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      runs.push({ startCol: runStart, endCol: i - 1 });
      runStart = -1;
    }
  }
  if (runStart !== -1) runs.push({ startCol: runStart, endCol: 6 });
  return runs;
}

/** 주·월 그리드 위 멀티데이 일정 막대 배치 */
export function layoutMonthBarSegments(
  weeks: Date[][],
  events: CalendarEvent[],
): MonthBarSegment[] {
  const barEvents = events.filter(isSpanningBarEvent);
  const segments: MonthBarSegment[] = [];

  weeks.forEach((week, weekIndex) => {
    const weekStart = startOfDay(week[0].getTime());
    const weekEnd = endOfDay(week[6].getTime());
    const raw: Omit<MonthBarSegment, "lane">[] = [];

    for (const event of barEvents) {
      if (event.endAt <= weekStart || event.startAt > weekEnd) continue;

      const titleCol = eventStartColInWeek(event, week);
      const titleDayKey = toDateLocal(week[titleCol].getTime());
      const titleExcluded = (event.excludedDates ?? []).includes(titleDayKey);

      for (const run of barRunsInWeek(event, week)) {
        raw.push({
          event,
          weekIndex,
          startCol: run.startCol,
          span: run.endCol - run.startCol + 1,
          showTitle:
            !titleExcluded && titleCol >= run.startCol && titleCol <= run.endCol,
          roundLeft: !hasIncludedDayBefore(event, week, run.startCol),
          roundRight: !hasIncludedDayAfter(event, week, run.endCol),
        });
      }
    }

    raw.sort((a, b) => a.startCol - b.startCol || b.span - a.span);
    const lanes: { startCol: number; span: number }[][] = [];

    for (const seg of raw) {
      let lane = 0;
      while (true) {
        if (!lanes[lane]) lanes[lane] = [];
        const conflict = lanes[lane].some((o) =>
          rangesOverlap(o.startCol, o.span, seg.startCol, seg.span),
        );
        if (!conflict) {
          lanes[lane].push({ startCol: seg.startCol, span: seg.span });
          segments.push({ ...seg, lane });
          break;
        }
        lane++;
      }
    }
  });

  return segments;
}

/** 막대가 아닌 단일 시각 일정 (셀 안 칩) */
export function singleDayChipEvents(day: Date, events: CalendarEvent[]): CalendarEvent[] {
  const from = startOfDay(day.getTime());
  const to = endOfDay(day.getTime());
  return events.filter(
    (e) => !isSpanningBarEvent(e) && e.startAt >= from && e.startAt <= to,
  );
}

export function sortEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return eventsForDay(events, day).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.startAt - b.startAt;
  });
}

const MONTH_MAX_BAR_LANES = 3;
const MONTH_MAX_CHIPS = 2;

/** 월간 셀에서 숨겨진 일정 개수 (막대 레인·칩 초과분) */
export function monthDayHiddenEventCount(
  day: Date,
  weekIndex: number,
  week: Date[],
  barSegments: MonthBarSegment[],
  events: CalendarEvent[],
): number {
  const col = week.findIndex((d) => d.toDateString() === day.toDateString());
  if (col < 0) return 0;

  const chipsHidden = Math.max(0, singleDayChipEvents(day, events).length - MONTH_MAX_CHIPS);
  const barsOnDay = barSegments.filter(
    (s) => s.weekIndex === weekIndex && col >= s.startCol && col < s.startCol + s.span,
  );
  const barsHidden = barsOnDay.filter((b) => b.lane >= MONTH_MAX_BAR_LANES).length;
  return chipsHidden + barsHidden;
}
