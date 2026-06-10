import type { CalendarEvent } from "./types";

/** 이모지 접두어 제거 후 그룹 키 */
export function normalizeEventGroupTitle(title: string): string {
  return title.replace(/^📋\s*/, "").replace(/^📅\s*/, "").trim();
}

export type TodayEventGroup = {
  key: string;
  title: string;
  items: CalendarEvent[];
};

/** API·클라이언트 양쪽에서 온 동일 업무 마감 중복 제거 */
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
    const key = normalizeEventGroupTitle(event.title);
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

export function eventListSubtitle(event: CalendarEvent): string {
  if (event.sourceType === "task") return `업무 마감 · ${event.teamName}`;
  return `${event.time} · ${event.teamName}`;
}
