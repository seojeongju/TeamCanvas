import { newId, now, startOfDay, endOfDay } from "./helpers";

export async function syncProjectMilestonesToCalendar(
  db: D1Database,
  opts: {
    projectId: string;
    orgId: string;
    userId: string;
    teamId: string | null;
    projectName: string;
    projectColor: string;
  },
): Promise<{ created: number; skipped: number }> {
  const { results: milestones } = await db
    .prepare(
      `SELECT id, title, due_at, calendar_event_id FROM project_milestones
       WHERE project_id = ? AND due_at IS NOT NULL
       ORDER BY sort_order ASC`,
    )
    .bind(opts.projectId)
    .all();

  let created = 0;
  let skipped = 0;
  const ts = now();

  for (const row of milestones ?? []) {
    const m = row as Record<string, unknown>;
    if (m.calendar_event_id) {
      skipped++;
      continue;
    }

    const dueAt = m.due_at as number;
    const startAt = startOfDay(dueAt);
    const endAt = endOfDay(dueAt);
    const eventId = newId();
    const title = `[마일스톤] ${m.title as string}`;

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
        `프로젝트: ${opts.projectName}`,
        startAt,
        endAt,
        opts.teamId ? "team" : "org",
        opts.projectColor,
        ts,
        ts,
      )
      .run();

    await db
      .prepare(
        `UPDATE project_milestones SET calendar_event_id = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(eventId, ts, m.id)
      .run();

    created++;
  }

  return { created, skipped };
}
