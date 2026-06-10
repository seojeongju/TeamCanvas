import { endOfDay, startOfDay } from "./helpers";

export async function getDashboardInsights(db: D1Database, orgId: string) {
  const now = Date.now();
  const weekEnd = endOfDay(now + 7 * 24 * 60 * 60 * 1000);
  const weekStart = startOfDay(now);

  const statusRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM tasks
       WHERE organization_id = ? GROUP BY status`,
    )
    .bind(orgId)
    .all<{ status: string; cnt: number }>();

  const tasksByStatus = { todo: 0, doing: 0, done: 0 };
  for (const row of statusRows.results ?? []) {
    if (row.status in tasksByStatus) {
      tasksByStatus[row.status as keyof typeof tasksByStatus] = row.cnt;
    }
  }

  const { results: dueSoon } = await db
    .prepare(
      `SELECT t.id, t.title, t.due_at, t.status, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.organization_id = ?
         AND t.status != 'done'
         AND t.due_at IS NOT NULL
         AND t.due_at >= ?
         AND t.due_at <= ?
       ORDER BY t.due_at ASC
       LIMIT 8`,
    )
    .bind(orgId, now, weekEnd)
    .all();

  const weekEvents = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM events
       WHERE organization_id = ?
         AND start_at < ?
         AND end_at > ?`,
    )
    .bind(orgId, weekEnd, weekStart)
    .first<{ cnt: number }>();

  const { results: teamRows } = await db
    .prepare(
      `SELECT tm.id AS team_id, tm.name AS team_name,
              SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) AS todo,
              SUM(CASE WHEN t.status = 'doing' THEN 1 ELSE 0 END) AS doing,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done
       FROM teams tm
       LEFT JOIN tasks t ON t.team_id = tm.id AND t.organization_id = tm.organization_id
       WHERE tm.organization_id = ?
       GROUP BY tm.id
       ORDER BY doing DESC, todo DESC
       LIMIT 6`,
    )
    .bind(orgId)
    .all();

  return {
    tasksByStatus,
    dueSoonTasks: (dueSoon ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        title: row.title as string,
        dueAt: row.due_at as number,
        status: row.status as string,
        assigneeName: (row.assignee_name as string | null) ?? "미배정",
      };
    }),
    weekEventCount: weekEvents?.cnt ?? 0,
    teamWorkload: (teamRows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        teamId: row.team_id as string,
        teamName: row.team_name as string,
        todo: Number(row.todo ?? 0),
        doing: Number(row.doing ?? 0),
        done: Number(row.done ?? 0),
      };
    }),
  };
}

export async function buildWeeklyReportCsv(
  db: D1Database,
  orgId: string,
  from: number,
  to: number,
): Promise<string> {
  const { results: tasks } = await db
    .prepare(
      `SELECT t.title, t.status, t.priority, t.due_at, t.updated_at, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.organization_id = ?
         AND t.updated_at >= ? AND t.updated_at <= ?
       ORDER BY t.updated_at DESC`,
    )
    .bind(orgId, from, to)
    .all();

  const { results: events } = await db
    .prepare(
      `SELECT e.title, e.start_at, e.end_at, e.all_day, t.name AS team_name
       FROM events e
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE e.organization_id = ?
         AND e.start_at < ? AND e.end_at > ?
       ORDER BY e.start_at ASC`,
    )
    .bind(orgId, to, from)
    .all();

  const lines: string[] = [];
  lines.push("TeamCanvas 주간 리포트");
  lines.push(`기간,${new Date(from).toLocaleDateString("ko-KR")} ~ ${new Date(to).toLocaleDateString("ko-KR")}`);
  lines.push("");
  lines.push("[업무]");
  lines.push("제목,상태,우선순위,담당자,마감일,수정일");
  for (const row of tasks ?? []) {
    const r = row as Record<string, unknown>;
    const due = r.due_at ? new Date(r.due_at as number).toLocaleDateString("ko-KR") : "";
    const updated = new Date(r.updated_at as number).toLocaleDateString("ko-KR");
    lines.push(
      [
        csvEscape(r.title as string),
        csvEscape(r.status as string),
        csvEscape(r.priority as string),
        csvEscape((r.assignee_name as string) ?? ""),
        due,
        updated,
      ].join(","),
    );
  }
  lines.push("");
  lines.push("[일정]");
  lines.push("제목,팀,시작,종료,종일");
  for (const row of events ?? []) {
    const r = row as Record<string, unknown>;
    const allDay = Boolean(r.all_day);
    lines.push(
      [
        csvEscape(r.title as string),
        csvEscape((r.team_name as string) ?? ""),
        new Date(r.start_at as number).toLocaleString("ko-KR"),
        new Date(r.end_at as number).toLocaleString("ko-KR"),
        allDay ? "Y" : "N",
      ].join(","),
    );
  }

  return "\uFEFF" + lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
