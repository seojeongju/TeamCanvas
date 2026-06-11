import { isPersonalGoogleEvent } from "./calendarEventSources";
import { formatEventTimeRange } from "./dates";
import type { CalendarEvent } from "./types";

/** 이모지 접두어 제거 후 그룹 키 */
export function normalizeEventGroupTitle(title: string): string {
  return title.replace(/^📋\s*/, "").replace(/^📅\s*/, "").trim();
}

/** 개인 Google 일정과 팀 일정은 절대 같은 그룹으로 묶지 않음 */
function todayGroupKey(event: CalendarEvent): string {
  const title = normalizeEventGroupTitle(event.title);
  const bucket = isPersonalGoogleEvent(event) ? "personal" : "team";
  return `${bucket}:${title}`;
}

export type TodayEventGroup = {
  key: string;
  title: string;
  items: CalendarEvent[];
};

/** API·클라이언트 양쪽에서 온 동일 프로젝트 마감 중복 제거 */
export function dedupeCalendarEvents(
  apiEvents: CalendarEvent[],
  clientTaskEvents: CalendarEvent[],
): CalendarEvent[] {
  const apiTaskIds = new Set(
    apiEvents.filter((e) => e.sourceType === "task" && e.taskId).map((e) => e.taskId!),
  );
  const extraTasks = clientTaskEvents.filter((e) => !e.taskId || !apiTaskIds.has(e.taskId));
  return [...apiEvents, ...extraTasks].sort((a, b) => a.startAt - b.startAt);
}

export function groupTodayEvents(events: CalendarEvent[]): TodayEventGroup[] {
  const map = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = todayGroupKey(event);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    title: normalizeEventGroupTitle(items[0].title),
    items: items.sort((a, b) => a.startAt - b.startAt),
  }));
}

export type EventDisplayContext = {
  viewerId?: string;
  memberNames?: Record<string, string>;
};

export function formatEventCreatorLabel(
  event: CalendarEvent,
  viewerId?: string,
  memberNames?: Record<string, string>,
): string | null {
  if (isPersonalGoogleEvent(event) || event.sourceType === "task") return null;
  const name =
    event.creatorName?.trim() ||
    (event.creatorId ? memberNames?.[event.creatorId]?.trim() : undefined);
  if (!name) return null;
  if (viewerId && event.creatorId === viewerId) return "내 일정";
  return name;
}

function appendCreatorLabel(
  base: string,
  event: CalendarEvent,
  ctx?: EventDisplayContext,
): string {
  const creator = formatEventCreatorLabel(event, ctx?.viewerId, ctx?.memberNames);
  return creator ? `${base} · ${creator}` : base;
}

export function eventListSubtitle(event: CalendarEvent, ctx?: EventDisplayContext): string {
  if (isPersonalGoogleEvent(event)) return "내 Google 일정 · 팀원에게 비공개";
  if (event.sourceType === "task") return `프로젝트 마감 · ${event.teamName}`;
  return appendCreatorLabel(
    `${formatEventTimeRange(event.startAt, event.endAt, event.allDay)} · ${event.teamName}`,
    event,
    ctx,
  );
}
