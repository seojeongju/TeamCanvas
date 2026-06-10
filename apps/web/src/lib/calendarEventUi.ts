import { cn } from "./cn";
import { normalizeEventGroupTitle } from "./todayEventsGroup";
import { isPersonalGoogleEvent } from "./calendarEventSources";
import type { CalendarEvent } from "./types";

export function formatEventWhen(event: CalendarEvent, day?: Date): string {
  if (day) {
    return day.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      ...(event.allDay
        ? {}
        : {
            hour: "2-digit",
            minute: "2-digit",
          }),
    });
  }
  if (event.allDay) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const endDay = new Date(end);
    if (end.getHours() === 0 && end.getMinutes() === 0) {
      endDay.setDate(endDay.getDate() - 1);
    }
    const sameDay =
      start.getFullYear() === endDay.getFullYear() &&
      start.getMonth() === endDay.getMonth() &&
      start.getDate() === endDay.getDate();
    if (sameDay) {
      return `${start.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} · 종일`;
    }
    return `${start.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} – ${endDay.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} · 종일`;
  }
  return event.time;
}

export function eventSourceLabel(event: CalendarEvent): string {
  if (isPersonalGoogleEvent(event)) return "내 Google 일정 · 팀원 비공개 · 읽기 전용";
  if (event.sourceType === "task") return `프로젝트 마감 · ${event.teamName}`;
  return event.teamName;
}

export function eventPreviewTitle(event: CalendarEvent): string {
  return normalizeEventGroupTitle(event.title);
}

export function calendarEventAriaLabel(event: CalendarEvent, day?: Date): string {
  return `${eventPreviewTitle(event)}, ${formatEventWhen(event, day)}, ${eventSourceLabel(event)}`;
}

/** Phase A — 공통 호버·포커스 액션 상태 */
export function calendarEventInteractionClassName(): string {
  return cn(
    "cursor-pointer transition-all duration-150 ease-out",
    "hover:brightness-110 hover:shadow-md hover:z-20",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/80 focus-visible:z-20",
    "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
  );
}

export function monthGridEventLabel(event: CalendarEvent, showTitle: boolean): string {
  if (!showTitle) return "\u00a0";
  if (event.sourceType === "task") return `마감 ${event.title}`;
  if (isPersonalGoogleEvent(event)) return `개인 ${event.title}`;
  return event.title;
}

export type EventPreviewMeta = {
  title: string;
  when: string;
  source: string;
  location: string | null;
  description: string | null;
};

export function buildEventPreviewMeta(event: CalendarEvent, day?: Date): EventPreviewMeta {
  return {
    title: eventPreviewTitle(event),
    when: formatEventWhen(event, day),
    source: eventSourceLabel(event),
    location: event.location?.trim() ? event.location.trim() : null,
    description: event.description?.trim() ? event.description.trim() : null,
  };
}
