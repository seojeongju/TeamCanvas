import { endOfDay, formatDateOnlyKst, formatDateTimeKst, startOfDay } from "./helpers";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "계획",
  active: "진행 중",
  on_hold: "보류",
  done: "완료",
  archived: "보관됨",
};

function computeProgressPercent(taskCount: number, openTaskCount: number, milestoneCount: number, doneMilestoneCount: number): number | null {
  const rates: number[] = [];
  if (taskCount > 0) rates.push(((taskCount - openTaskCount) / taskCount) * 100);
  if (milestoneCount > 0) rates.push((doneMilestoneCount / milestoneCount) * 100);
  return rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
}

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

  const { results: dueSoonMilestones } = await db
    .prepare(
      `SELECT m.id, m.title, m.due_at, p.id AS project_id, p.name AS project_name
       FROM project_milestones m
       JOIN projects p ON p.id = m.project_id
       WHERE p.organization_id = ?
         AND m.status = 'pending'
         AND m.due_at IS NOT NULL
         AND m.due_at >= ?
         AND m.due_at <= ?
       ORDER BY m.due_at ASC
       LIMIT 6`,
    )
    .bind(orgId, now, weekEnd)
    .all();

  const projectStatusRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM projects
       WHERE organization_id = ? GROUP BY status`,
    )
    .bind(orgId)
    .all<{ status: string; cnt: number }>();

  const projectsByStatus = { planning: 0, active: 0, on_hold: 0, done: 0, archived: 0 };
  for (const row of projectStatusRows.results ?? []) {
    if (row.status in projectsByStatus) {
      projectsByStatus[row.status as keyof typeof projectsByStatus] = row.cnt;
    }
  }

  const { results: projectWorkloadRows } = await db
    .prepare(
      `SELECT p.id, p.name, p.status,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') AS open_task_count,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id) AS milestone_count,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id AND status = 'done') AS done_milestone_count
       FROM projects p
       WHERE p.organization_id = ? AND p.status IN ('planning', 'active')
       ORDER BY open_task_count DESC, p.updated_at DESC
       LIMIT 6`,
    )
    .bind(orgId)
    .all();

  const tasksCompletedWeek = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM tasks
       WHERE organization_id = ? AND status = 'done'
         AND updated_at >= ? AND updated_at <= ?`,
    )
    .bind(orgId, weekStart, now)
    .first<{ cnt: number }>();

  const milestonesCompletedWeek = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM project_milestones m
       JOIN projects p ON p.id = m.project_id
       WHERE p.organization_id = ? AND m.status = 'done'
         AND m.updated_at >= ? AND m.updated_at <= ?`,
    )
    .bind(orgId, weekStart, now)
    .first<{ cnt: number }>();

  const projectsUpdatedWeek = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM projects
       WHERE organization_id = ? AND updated_at >= ? AND updated_at <= ?`,
    )
    .bind(orgId, weekStart, now)
    .first<{ cnt: number }>();

  const { results: overdueProjects } = await db
    .prepare(
      `SELECT p.id, p.name, p.end_at, p.status, u.name AS owner_name
       FROM projects p
       LEFT JOIN users u ON u.id = p.owner_id
       WHERE p.organization_id = ?
         AND p.end_at IS NOT NULL
         AND p.end_at < ?
         AND p.status IN ('planning', 'active', 'on_hold')
       ORDER BY p.end_at ASC
       LIMIT 6`,
    )
    .bind(orgId, now)
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
    dueSoonMilestones: (dueSoonMilestones ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        title: row.title as string,
        dueAt: row.due_at as number,
        projectId: row.project_id as string,
        projectName: row.project_name as string,
      };
    }),
    overdueProjects: (overdueProjects ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        endAt: row.end_at as number,
        status: row.status as string,
        ownerName: (row.owner_name as string | null) ?? "",
      };
    }),
    projectsByStatus,
    activeProjectWorkload: (projectWorkloadRows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      const taskCount = Number(row.task_count ?? 0);
      const openTaskCount = Number(row.open_task_count ?? 0);
      const milestoneCount = Number(row.milestone_count ?? 0);
      const doneMilestoneCount = Number(row.done_milestone_count ?? 0);
      return {
        id: row.id as string,
        name: row.name as string,
        status: row.status as string,
        taskCount,
        openTaskCount,
        progressPercent: computeProgressPercent(taskCount, openTaskCount, milestoneCount, doneMilestoneCount),
      };
    }),
    weekStats: {
      tasksCompleted: tasksCompletedWeek?.cnt ?? 0,
      milestonesCompleted: milestonesCompletedWeek?.cnt ?? 0,
      projectsUpdated: projectsUpdatedWeek?.cnt ?? 0,
    },
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
  lines.push(`기간,${formatDateOnlyKst(from)} ~ ${formatDateOnlyKst(to)}`);
  lines.push("");
  lines.push("[업무]");
  lines.push("제목,상태,우선순위,담당자,마감일,수정일");
  for (const row of tasks ?? []) {
    const r = row as Record<string, unknown>;
    const due = r.due_at ? formatDateOnlyKst(r.due_at as number) : "";
    const updated = formatDateOnlyKst(r.updated_at as number);
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
        formatDateTimeKst(r.start_at as number),
        formatDateTimeKst(r.end_at as number),
        allDay ? "Y" : "N",
      ].join(","),
    );
  }

  const { results: projects } = await db
    .prepare(
      `SELECT p.name, p.status, u.name AS owner_name, p.start_at, p.end_at, p.updated_at,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') AS done_task_count
       FROM projects p
       LEFT JOIN users u ON u.id = p.owner_id
       WHERE p.organization_id = ? AND p.updated_at >= ? AND p.updated_at <= ?
       ORDER BY p.updated_at DESC`,
    )
    .bind(orgId, from, to)
    .all();

  lines.push("");
  lines.push("[프로젝트]");
  lines.push("이름,상태,담당자,시작일,종료일,업무수,완료업무,수정일");
  for (const row of projects ?? []) {
    const r = row as Record<string, unknown>;
    lines.push(
      [
        csvEscape(r.name as string),
        csvEscape(PROJECT_STATUS_LABELS[r.status as string] ?? (r.status as string)),
        csvEscape((r.owner_name as string) ?? ""),
        r.start_at ? formatDateOnlyKst(r.start_at as number) : "",
        r.end_at ? formatDateOnlyKst(r.end_at as number) : "",
        String(r.task_count ?? 0),
        String(r.done_task_count ?? 0),
        formatDateOnlyKst(r.updated_at as number),
      ].join(","),
    );
  }

  const { results: milestones } = await db
    .prepare(
      `SELECT p.name AS project_name, m.title, m.status, m.due_at, m.updated_at
       FROM project_milestones m
       JOIN projects p ON p.id = m.project_id
       WHERE p.organization_id = ? AND m.updated_at >= ? AND m.updated_at <= ?
       ORDER BY m.updated_at DESC`,
    )
    .bind(orgId, from, to)
    .all();

  lines.push("");
  lines.push("[마일스톤]");
  lines.push("프로젝트,제목,상태,마감일,수정일");
  for (const row of milestones ?? []) {
    const r = row as Record<string, unknown>;
    lines.push(
      [
        csvEscape(r.project_name as string),
        csvEscape(r.title as string),
        csvEscape(r.status === "done" ? "완료" : "예정"),
        r.due_at ? formatDateOnlyKst(r.due_at as number) : "",
        formatDateOnlyKst(r.updated_at as number),
      ].join(","),
    );
  }

  const { results: projectTasks } = await db
    .prepare(
      `SELECT p.name AS project_name, t.title, t.status, t.priority, u.name AS assignee_name, t.due_at, t.updated_at
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.organization_id = ? AND t.updated_at >= ? AND t.updated_at <= ?
       ORDER BY t.updated_at DESC`,
    )
    .bind(orgId, from, to)
    .all();

  lines.push("");
  lines.push("[프로젝트 업무]");
  lines.push("프로젝트,제목,상태,우선순위,담당자,마감일,수정일");
  for (const row of projectTasks ?? []) {
    const r = row as Record<string, unknown>;
    lines.push(
      [
        csvEscape(r.project_name as string),
        csvEscape(r.title as string),
        csvEscape(r.status as string),
        csvEscape(r.priority as string),
        csvEscape((r.assignee_name as string) ?? ""),
        r.due_at ? formatDateOnlyKst(r.due_at as number) : "",
        formatDateOnlyKst(r.updated_at as number),
      ].join(","),
    );
  }

  return "\uFEFF" + lines.join("\n");
}

export async function buildMonthlyReportCsv(
  db: D1Database,
  orgId: string,
  from: number,
  to: number,
  year: number,
  month: number,
) {
  const base = await buildWeeklyReportCsv(db, orgId, from, to);
  const lines = base.replace(/^\uFEFF/, "").split("\n");

  const taskStats = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM tasks
       WHERE organization_id = ? AND updated_at >= ? AND updated_at <= ?
       GROUP BY status`,
    )
    .bind(orgId, from, to)
    .all<{ status: string; cnt: number }>();

  const eventCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM events
       WHERE organization_id = ? AND start_at < ? AND end_at > ?`,
    )
    .bind(orgId, to, from)
    .first<{ cnt: number }>();

  const summary = [
    "",
    "[월간 요약]",
    "항목,건수",
    ...(taskStats.results ?? []).map((row) => `업무 ${row.status},${row.cnt}`),
    `일정,${eventCount?.cnt ?? 0}`,
    "",
  ];

  lines[0] = "TeamCanvas 월간 리포트";
  lines[1] = `기간,${year}년 ${month}월 (${formatDateOnlyKst(from)} ~ ${formatDateOnlyKst(to)})`;

  return "\uFEFF" + [...lines.slice(0, 2), ...summary, ...lines.slice(2)].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
