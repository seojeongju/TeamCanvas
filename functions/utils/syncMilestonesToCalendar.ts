import { allDaySpanKst, newId, now } from "./helpers";

type SyncOpts = {
  projectId: string;
  orgId: string;
  userId: string;
  teamId: string | null;
  projectName: string;
  projectColor: string;
};

async function upsertMilestoneEvent(
  db: D1Database,
  row: Record<string, unknown>,
  opts: SyncOpts,
  ts: number,
): Promise<"created" | "updated" | "skipped"> {
  const dueAt = row.due_at as number | null;
  if (!dueAt) return "skipped";

  const { startAt, endAt } = allDaySpanKst(dueAt);
  const title = (row.title as string).trim();
  const description = `프로젝트: ${opts.projectName}`;
  const visibility = opts.teamId ? "team" : "org";
  const existingEventId = row.calendar_event_id as string | null;

  if (existingEventId) {
    await db
      .prepare(
        `UPDATE events SET title = ?, description = ?, start_at = ?, end_at = ?, all_day = 1, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
      )
      .bind(title, description, startAt, endAt, ts, existingEventId, opts.orgId)
      .run();
    return "updated";
  }

  const eventId = newId();
  await db
    .prepare(
      `INSERT INTO events (
        id, organization_id, team_id, creator_id, title, description, location,
        start_at, end_at, all_day, visibility, recurrence_rule, excluded_dates_json, color, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, NULL, NULL, ?, ?, ?)`,
    )
    .bind(
      eventId,
      opts.orgId,
      opts.teamId,
      opts.userId,
      title,
      description,
      startAt,
      endAt,
      visibility,
      opts.projectColor,
      ts,
      ts,
    )
    .run();

  await db
    .prepare(`UPDATE project_milestones SET calendar_event_id = ?, updated_at = ? WHERE id = ?`)
    .bind(eventId, ts, row.id)
    .run();

  return "created";
}

export async function syncProjectMilestonesToCalendar(
  db: D1Database,
  opts: SyncOpts,
): Promise<{ created: number; updated: number; skipped: number }> {
  const { results: milestones } = await db
    .prepare(
      `SELECT id, title, due_at, calendar_event_id FROM project_milestones
       WHERE project_id = ? AND due_at IS NOT NULL
       ORDER BY sort_order ASC`,
    )
    .bind(opts.projectId)
    .all();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const ts = now();

  for (const row of milestones ?? []) {
    const result = await upsertMilestoneEvent(db, row as Record<string, unknown>, opts, ts);
    if (result === "created") created++;
    else if (result === "updated") updated++;
    else skipped++;
  }

  return { created, updated, skipped };
}

export async function syncMilestoneCalendarEvent(
  db: D1Database,
  milestoneId: string,
  opts: SyncOpts,
): Promise<"created" | "updated" | "skipped"> {
  const row = await db
    .prepare(`SELECT id, title, due_at, calendar_event_id FROM project_milestones WHERE id = ?`)
    .bind(milestoneId)
    .first<Record<string, unknown>>();
  if (!row) return "skipped";
  return upsertMilestoneEvent(db, row, opts, now());
}
