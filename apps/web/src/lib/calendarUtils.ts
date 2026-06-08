import { endOfDay, startOfDay } from "./dates";

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

export function eventsForDay<T extends { startAt: number; endAt: number }>(events: T[], day: Date): T[] {
  const from = startOfDay(day.getTime());
  const to = endOfDay(day.getTime());
  return events.filter((e) => e.startAt < to && e.endAt > from);
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
