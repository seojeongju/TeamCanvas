import type { CalendarEvent } from "./types";

/** Google에서 가져온 개인 일정 — 본인에게만 노출 */
export function isPersonalGoogleEvent(event: CalendarEvent): boolean {
  return event.sourceType === "google" || event.isPersonal === true;
}

/** TeamCanvas에서 작성·공유되는 팀/조직 일정 */
export function isTeamCalendarEvent(event: CalendarEvent): boolean {
  return !isPersonalGoogleEvent(event);
}

export function splitCalendarEvents(events: CalendarEvent[]): {
  teamEvents: CalendarEvent[];
  personalGoogleEvents: CalendarEvent[];
} {
  const teamEvents: CalendarEvent[] = [];
  const personalGoogleEvents: CalendarEvent[] = [];
  for (const event of events) {
    if (isPersonalGoogleEvent(event)) personalGoogleEvents.push(event);
    else teamEvents.push(event);
  }
  return { teamEvents, personalGoogleEvents };
}

/** 캘린더 그리드·칩에서 개인 Google 일정 강조 */
export function personalGoogleEventClassName(): string {
  return "ring-2 ring-dashed ring-white/70";
}
