import { buildIcalCalendar } from "./ical";

export type IcalEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
};

export async function fetchVisibleOrgEvents(
  db: D1Database,
  orgId: string,
  userId: string,
  memberRole: string,
  from: number,
  to: number,
): Promise<{ orgName: string; events: IcalEventRow[] }> {
  const orgRow = await db
    .prepare("SELECT name, settings_json FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ name: string; settings_json: string | null }>();

  const { parseOrgSettings } = await import("./orgSettings");
  const { teamVisibilitySql } = await import("./orgGovernance");
  const calendarPolicy = parseOrgSettings(orgRow?.settings_json).calendarPolicy;
  const teamSql = teamVisibilitySql(calendarPolicy, memberRole);
  const teamBindNeeded = calendarPolicy !== "all_teams" || memberRole === "guest";

  const { results } = await db
    .prepare(
      `SELECT e.id, e.title, e.description, e.location, e.start_at, e.end_at, e.all_day
       FROM events e
       WHERE e.organization_id = ? AND e.start_at < ? AND e.end_at > ?
         AND (
           e.visibility = 'org'
           OR e.creator_id = ?
           OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = ?)
           OR ${teamSql}
         )
       ORDER BY e.start_at ASC`,
    )
    .bind(orgId, to, from, userId, userId, ...(teamBindNeeded ? [userId] : []))
    .all();

  const events = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      description: r.description as string | null,
      location: r.location as string | null,
      startAt: r.start_at as number,
      endAt: r.end_at as number,
      allDay: Boolean(r.all_day),
    };
  });

  return { orgName: orgRow?.name ?? "TeamCanvas", events };
}

export function buildIcalResponse(ics: string, filename: string, disposition: "attachment" | "inline" = "attachment") {
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-cache, max-age=300",
    },
  });
}

export function buildIcalFromEvents(events: IcalEventRow[], orgName: string) {
  return buildIcalCalendar(events, orgName);
}
