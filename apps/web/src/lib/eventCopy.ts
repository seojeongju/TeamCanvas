import type { CalendarEvent } from "./types";

export function copyEventTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.endsWith("(복사)")) return trimmed;
  return `${trimmed} (복사)`;
}

export function canCopyCalendarEvent(event: CalendarEvent): boolean {
  return event.sourceType !== "task" && event.sourceType !== "google";
}
