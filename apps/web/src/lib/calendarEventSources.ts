import type { CalendarEvent } from "./types";

/** 캘린더 범례·일정 소스별 기준 색상 */
export const CALENDAR_LEGEND_COLORS = {
  teamApp: "#4A9FE8",
  taskDue: "#F97316",
  google: "#EA4335",
} as const;

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

export function parseGoogleEventId(event: CalendarEvent): string | null {
  if (event.sourceType !== "google" || !event.id.startsWith("google:")) return null;
  return event.id.slice("google:".length);
}

/** Google Calendar 웹에서 해당 일정 열기 */
export function googleCalendarOpenUrl(event: CalendarEvent, calendarId = "primary"): string {
  const googleEventId = parseGoogleEventId(event);
  if (!googleEventId) return "https://calendar.google.com";
  const eid = btoa(`${googleEventId} ${calendarId}`);
  return `https://www.google.com/calendar/event?eid=${encodeURIComponent(eid)}`;
}
