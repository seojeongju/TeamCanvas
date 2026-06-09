const PREFIX = "teamcanvas-cache:";

type CacheEntry<T> = { at: number; data: T };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry.data;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { at: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded */
  }
}

export function cacheTasks(orgId: string, tasks: import("./types").Task[]) {
  write(`tasks:${orgId}`, tasks);
}

export function getCachedTasks(orgId: string): import("./types").Task[] | null {
  return read(`tasks:${orgId}`);
}

export function cacheEvents(orgId: string, from: number, to: number, events: import("./types").CalendarEvent[]) {
  write(`events:${orgId}:${from}:${to}`, events);
}

export function getCachedEvents(
  orgId: string,
  from: number,
  to: number,
): import("./types").CalendarEvent[] | null {
  return read(`events:${orgId}:${from}:${to}`);
}

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
