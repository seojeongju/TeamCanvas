import type { Env } from "../types";
import { newId, now } from "./helpers";

/** 읽기·쓰기 동기화 (재연결 시 동의 필요) */
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function googleCalendarRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
}

export function googleCalendarAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCalendarCode(
  env: Env,
  code: string,
  redirectUri: string,
): Promise<{ refresh_token: string; access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
  };
  if (!data.refresh_token) return null;
  return {
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

async function readGoogleApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string }; error_description?: string };
    return body.error?.message ?? body.error_description ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function refreshGoogleAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | { error: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    return { error: detail };
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function getValidGoogleAccessToken(
  db: D1Database,
  env: Env,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT refresh_token, access_token, expires_at FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?",
    )
    .bind(userId, orgId)
    .first<{ refresh_token: string; access_token: string | null; expires_at: number | null }>();

  if (!row) return null;

  const bufferMs = 60_000;
  if (row.access_token && row.expires_at && row.expires_at > now() + bufferMs) {
    return row.access_token;
  }

  const refreshed = await refreshGoogleAccessToken(env, row.refresh_token);
  if ("error" in refreshed) {
    throw new Error(
      `Google 토큰 갱신 실패: ${refreshed.error}. 연결 해제 후 다시 연결해 주세요.`,
    );
  }

  const expiresAt = now() + refreshed.expires_in * 1000;
  await db
    .prepare(
      "UPDATE google_calendar_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ? AND organization_id = ?",
    )
    .bind(refreshed.access_token, expiresAt, now(), userId, orgId)
    .run();

  return refreshed.access_token;
}

type GoogleEventItem = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function syncGoogleCalendarEvents(
  db: D1Database,
  env: Env,
  userId: string,
  orgId: string,
  from: number,
  to: number,
): Promise<{ imported: number }> {
  let accessToken: string;
  try {
    const token = await getValidGoogleAccessToken(db, env, userId, orgId);
    if (!token) throw new Error("Google 캘린더가 연결되어 있지 않습니다.");
    accessToken = token;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Google 캘린더 토큰을 확인할 수 없습니다.");
  }

  const tokenRow = await db
    .prepare("SELECT calendar_id FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?")
    .bind(userId, orgId)
    .first<{ calendar_id: string }>();

  const calendarId = encodeURIComponent(tokenRow?.calendar_id ?? "primary");
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set("timeMin", new Date(from).toISOString());
  url.searchParams.set("timeMax", new Date(to).toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    if (res.status === 403 && /disabled|not enabled/i.test(detail)) {
      throw new Error(
        "Google Calendar API가 비활성화되어 있습니다. Google Cloud Console에서 Calendar API를 활성화해 주세요.",
      );
    }
    throw new Error(`Google Calendar API 오류 (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { items?: GoogleEventItem[] };
  const items = data.items ?? [];
  const syncedAt = now();

  await db
    .prepare(
      "DELETE FROM google_calendar_events WHERE user_id = ? AND organization_id = ? AND start_at < ? AND end_at > ?",
    )
    .bind(userId, orgId, to, from)
    .run();

  let imported = 0;
  for (const item of items) {
    if (!item.id || item.start == null) continue;
    const allDay = Boolean(item.start.date);
    const startAt = allDay
      ? new Date(item.start.date + "T00:00:00").getTime()
      : new Date(item.start.dateTime!).getTime();
    const endRaw = allDay ? item.end?.date : item.end?.dateTime;
    const endAt = endRaw
      ? allDay
        ? new Date(endRaw + "T23:59:59").getTime()
        : new Date(endRaw).getTime()
      : startAt + 3600000;

    await db
      .prepare(
        `INSERT INTO google_calendar_events (
           id, user_id, organization_id, google_event_id, title, description, location,
           start_at, end_at, all_day, synced_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, organization_id, google_event_id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           location = excluded.location,
           start_at = excluded.start_at,
           end_at = excluded.end_at,
           all_day = excluded.all_day,
           synced_at = excluded.synced_at`,
      )
      .bind(
        newId(),
        userId,
        orgId,
        item.id,
        item.summary ?? "(제목 없음)",
        item.description ?? null,
        item.location ?? null,
        startAt,
        endAt,
        allDay ? 1 : 0,
        syncedAt,
      )
      .run();
    imported++;
  }

  return { imported };
}

export async function fetchGoogleCalendarEventsForRange(
  db: D1Database,
  userId: string,
  orgId: string,
  from: number,
  to: number,
) {
  const { results } = await db
    .prepare(
      `SELECT google_event_id, title, description, location, start_at, end_at, all_day
       FROM google_calendar_events
       WHERE user_id = ? AND organization_id = ? AND start_at < ? AND end_at > ?
       ORDER BY start_at ASC`,
    )
    .bind(userId, orgId, to, from)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const startAt = r.start_at as number;
    const endAt = r.end_at as number;
    const allDay = Boolean(r.all_day);
    return {
      id: `google:${r.google_event_id}`,
      title: `📅 ${r.title as string}`,
      description: r.description as string | null,
      location: r.location as string | null,
      startAt,
      endAt,
      allDay,
      visibility: "private",
      isPersonal: true,
      recurrenceRule: null,
      teamId: null,
      color: "#EA4335",
      teamName: "내 Google 일정",
      time: allDay
        ? new Date(startAt).toLocaleDateString("ko-KR")
        : `${new Date(startAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} – ${new Date(endAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
      sourceType: "google" as const,
    };
  });
}

type TeamCanvasEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: number;
  end_at: number;
  all_day: number;
  recurrence_rule: string | null;
};

function toGoogleEventBody(event: TeamCanvasEventRow): Record<string, unknown> {
  const allDay = Boolean(event.all_day);
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
  };

  if (allDay) {
    const startKey = toDateLocal(event.start_at);
    const endDate = new Date(event.end_at);
    endDate.setDate(endDate.getDate() + 1);
    body.start = { date: startKey };
    body.end = { date: toDateLocal(endDate.getTime()) };
  } else {
    body.start = { dateTime: new Date(event.start_at).toISOString(), timeZone: "Asia/Seoul" };
    body.end = { dateTime: new Date(event.end_at).toISOString(), timeZone: "Asia/Seoul" };
  }

  if (event.recurrence_rule) {
    body.recurrence = [`RRULE:${event.recurrence_rule}`];
  }

  return body;
}

function toDateLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function getGoogleCalendarId(
  db: D1Database,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT calendar_id FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?")
    .bind(userId, orgId)
    .first<{ calendar_id: string }>();
  return row?.calendar_id ?? null;
}

/** TeamCanvas 일정을 Google Calendar에보내기 (생성·수정) */
export async function pushEventToGoogleCalendar(
  db: D1Database,
  env: Env,
  userId: string,
  orgId: string,
  eventId: string,
): Promise<void> {
  const token = await getValidGoogleAccessToken(db, env, userId, orgId);
  if (!token) return;

  const event = await db
    .prepare(
      `SELECT id, title, description, location, start_at, end_at, all_day, recurrence_rule
       FROM events WHERE id = ? AND organization_id = ?`,
    )
    .bind(eventId, orgId)
    .first<TeamCanvasEventRow>();

  if (!event) return;

  const calendarId = encodeURIComponent((await getGoogleCalendarId(db, userId, orgId)) ?? "primary");
  const body = toGoogleEventBody(event);

  const existing = await db
    .prepare(
      "SELECT google_event_id FROM event_google_sync WHERE event_id = ? AND user_id = ?",
    )
    .bind(eventId, userId)
    .first<{ google_event_id: string }>();

  const ts = now();

  if (existing?.google_event_id) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(existing.google_event_id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const detail = await readGoogleApiError(res);
      throw new Error(`Google 일정 수정 실패: ${detail}`);
    }
    await db
      .prepare("UPDATE event_google_sync SET updated_at = ? WHERE event_id = ? AND user_id = ?")
      .bind(ts, eventId, userId)
      .run();
    return;
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(`Google 일정 생성 실패: ${detail}`);
  }

  const created = (await res.json()) as { id?: string };
  if (!created.id) return;

  await db
    .prepare(
      `INSERT INTO event_google_sync (event_id, user_id, organization_id, google_event_id, calendar_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET
         google_event_id = excluded.google_event_id,
         updated_at = excluded.updated_at`,
    )
    .bind(eventId, userId, orgId, created.id, decodeURIComponent(calendarId), ts)
    .run();
}

/** TeamCanvas 일정 삭제 시 Google Calendar에서도 제거 */
export async function removeEventFromGoogleCalendar(
  db: D1Database,
  env: Env,
  userId: string,
  orgId: string,
  eventId: string,
): Promise<void> {
  const token = await getValidGoogleAccessToken(db, env, userId, orgId);
  if (!token) return;

  const sync = await db
    .prepare(
      "SELECT google_event_id, calendar_id FROM event_google_sync WHERE event_id = ? AND user_id = ?",
    )
    .bind(eventId, userId)
    .first<{ google_event_id: string; calendar_id: string }>();

  if (!sync) return;

  const calendarId = encodeURIComponent(sync.calendar_id || "primary");
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(sync.google_event_id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  ).catch(() => undefined);

  await db
    .prepare("DELETE FROM event_google_sync WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .run();
}
