export type BusyBlock = {
  startAt: number;
  endAt: number;
  allDay: boolean;
  title: string | null;
};

type RawEvent = {
  id: string;
  title: string;
  start_at: number;
  end_at: number;
  all_day: number;
  visibility: string;
  creator_id: string;
  team_id: string | null;
};

export async function getUserBusyBlocks(
  db: D1Database,
  orgId: string,
  userId: string,
  requesterId: string,
  from: number,
  to: number,
): Promise<BusyBlock[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT e.id, e.title, e.start_at, e.end_at, e.all_day, e.visibility, e.creator_id, e.team_id
       FROM events e
       LEFT JOIN event_attendees ea ON ea.event_id = e.id
       WHERE e.organization_id = ?
         AND e.start_at < ? AND e.end_at > ?
         AND (e.creator_id = ? OR ea.user_id = ?)
       ORDER BY e.start_at`,
    )
    .bind(orgId, to, from, userId, userId)
    .all<RawEvent>();

  const blocks: BusyBlock[] = [];
  for (const e of results ?? []) {
    const canSeeTitle = await canRequesterSeeEventTitle(db, orgId, requesterId, e);
    blocks.push({
      startAt: e.start_at,
      endAt: e.end_at,
      allDay: Boolean(e.all_day),
      title: canSeeTitle ? e.title : null,
    });
  }
  return blocks;
}

async function canRequesterSeeEventTitle(
  db: D1Database,
  orgId: string,
  requesterId: string,
  event: RawEvent,
): Promise<boolean> {
  if (event.creator_id === requesterId) return true;
  if (event.visibility === "org") return true;

  const isAttendee = await db
    .prepare("SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ?")
    .bind(event.id, requesterId)
    .first();
  if (isAttendee) return true;

  if (event.visibility === "team" && event.team_id) {
    const inTeam = await db
      .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?")
      .bind(event.team_id, requesterId)
      .first();
    if (inTeam) return true;
  }

  return false;
}
