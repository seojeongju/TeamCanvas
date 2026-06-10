import { formatEventTime, hashToken, newId, now } from "./helpers";

export type SharedEventView = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
  time: string;
  organizationName: string;
  teamName: string | null;
};

export async function resolveEventShareToken(
  db: D1Database,
  rawToken: string,
): Promise<{ eventId: string; organizationId: string; tokenHash: string } | null> {
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = await hashToken(rawToken);
  const row = await db
    .prepare(
      `SELECT event_id, organization_id, expires_at
       FROM event_share_tokens
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ event_id: string; organization_id: string; expires_at: number | null }>();

  if (!row) return null;
  if (row.expires_at != null && row.expires_at < now()) return null;

  return { eventId: row.event_id, organizationId: row.organization_id, tokenHash };
}

export async function fetchSharedEvent(
  db: D1Database,
  eventId: string,
  organizationId: string,
): Promise<SharedEventView | null> {
  const row = await db
    .prepare(
      `SELECT e.title, e.description, e.location, e.start_at, e.end_at, e.all_day,
              o.name AS org_name, t.name AS team_name
       FROM events e
       JOIN organizations o ON o.id = e.organization_id
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE e.id = ? AND e.organization_id = ?
         AND e.visibility IN ('team', 'org')`,
    )
    .bind(eventId, organizationId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const startAt = row.start_at as number;
  const endAt = row.end_at as number;
  const allDay = Boolean(row.all_day);

  return {
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    startAt,
    endAt,
    allDay,
    time: formatEventTime(startAt, endAt, allDay),
    organizationName: row.org_name as string,
    teamName: (row.team_name as string | null) ?? null,
  };
}

export async function createEventShareToken(
  db: D1Database,
  opts: {
    eventId: string;
    organizationId: string;
    createdBy: string;
    expiresAt?: number | null;
  },
): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await hashToken(token);
  const ts = now();

  await db
    .prepare("DELETE FROM event_share_tokens WHERE event_id = ?")
    .bind(opts.eventId)
    .run();

  await db
    .prepare(
      `INSERT INTO event_share_tokens (id, event_id, organization_id, token_hash, created_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), opts.eventId, opts.organizationId, tokenHash, opts.createdBy, opts.expiresAt ?? null, ts)
    .run();

  return token;
}

export async function touchEventShareToken(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare("UPDATE event_share_tokens SET last_used_at = ? WHERE token_hash = ?")
    .bind(now(), tokenHash)
    .run();
}
