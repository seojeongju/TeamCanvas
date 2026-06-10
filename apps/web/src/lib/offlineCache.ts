import { idbGet, idbSet } from "./idb";

const PREFIX = "teamcanvas-cache:";
type CacheEntry<T> = { at: number; data: T };

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry.data;
  } catch {
    return null;
  }
}

function lsWrite<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { at: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

async function read<T>(key: string): Promise<T | null> {
  const fromIdb = await idbGet<CacheEntry<T>>(key);
  if (fromIdb?.data) return fromIdb.data;
  const fromLs = lsRead<T>(key);
  if (fromLs) {
    await write(key, fromLs);
  }
  return fromLs;
}

async function write<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { at: Date.now(), data };
  await idbSet(key, entry);
  lsWrite(key, data);
}

export function cacheTasks(orgId: string, tasks: import("./types").Task[]) {
  void write(`tasks:${orgId}`, tasks);
}

export async function getCachedTasks(orgId: string): Promise<import("./types").Task[] | null> {
  return read(`tasks:${orgId}`);
}

export function cacheEvents(
  orgId: string,
  from: number,
  to: number,
  events: import("./types").CalendarEvent[],
) {
  void write(`events:${orgId}:${from}:${to}`, events);
}

export async function getCachedEvents(
  orgId: string,
  from: number,
  to: number,
): Promise<import("./types").CalendarEvent[] | null> {
  return read(`events:${orgId}:${from}:${to}`);
}

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** 동기 placeholderData용 — IDB 비동기 전 localStorage 폴백 */
export function getCachedTasksSync(orgId: string): import("./types").Task[] | null {
  return lsRead(`tasks:${orgId}`);
}

export function getCachedEventsSync(
  orgId: string,
  from: number,
  to: number,
): import("./types").CalendarEvent[] | null {
  return lsRead(`events:${orgId}:${from}:${to}`);
}
