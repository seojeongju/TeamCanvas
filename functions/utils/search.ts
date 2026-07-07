import { formatActivityTimeKst, formatDateOnlyKst } from "./helpers";

export type SearchResultType = "event" | "task" | "project" | "milestone" | "member" | "comment";

export type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  link: string;
};

export type SearchFilters = {
  teamId?: string;
  projectId?: string;
  status?: string;
  assigneeId?: string;
  dateFrom?: number;
  dateTo?: number;
};

export type SearchOptions = {
  userId?: string;
  orgRole?: string;
  types?: SearchResultType[];
  filters?: SearchFilters;
};

function memberProjectAccessSql(userId?: string, orgRole?: string): string {
  if (!userId || !orgRole || orgRole === "owner" || orgRole === "admin") return "";
  return ` AND (p.owner_id = ? OR EXISTS (
     SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?
   ))`;
}

function taskFilterSql(filters?: SearchFilters): { sql: string; binds: unknown[] } {
  const sql: string[] = [];
  const binds: unknown[] = [];
  if (filters?.teamId) {
    sql.push(" AND t.team_id = ?");
    binds.push(filters.teamId);
  }
  if (filters?.projectId) {
    sql.push(" AND t.project_id = ?");
    binds.push(filters.projectId);
  }
  if (filters?.status) {
    sql.push(" AND t.status = ?");
    binds.push(filters.status);
  }
  if (filters?.assigneeId) {
    sql.push(" AND t.assignee_id = ?");
    binds.push(filters.assigneeId);
  }
  if (filters?.dateFrom != null) {
    sql.push(" AND t.due_at IS NOT NULL AND t.due_at >= ?");
    binds.push(filters.dateFrom);
  }
  if (filters?.dateTo != null) {
    sql.push(" AND t.due_at IS NOT NULL AND t.due_at <= ?");
    binds.push(filters.dateTo);
  }
  return { sql: sql.join(""), binds };
}

function eventFilterSql(filters?: SearchFilters): { sql: string; binds: unknown[] } {
  const sql: string[] = [];
  const binds: unknown[] = [];
  if (filters?.teamId) {
    sql.push(" AND e.team_id = ?");
    binds.push(filters.teamId);
  }
  if (filters?.dateFrom != null) {
    sql.push(" AND e.start_at >= ?");
    binds.push(filters.dateFrom);
  }
  if (filters?.dateTo != null) {
    sql.push(" AND e.start_at <= ?");
    binds.push(filters.dateTo);
  }
  return { sql: sql.join(""), binds };
}

export async function searchOrganization(
  db: D1Database,
  orgId: string,
  query: string,
  limit = 20,
  opts?: SearchOptions,
): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (!q) return [];

  const types = opts?.types?.length
    ? opts.types
    : (["event", "task", "project", "milestone", "member", "comment"] as SearchResultType[]);
  const pattern = `%${q}%`;
  const perType = Math.max(4, Math.ceil(limit / types.length));
  const results: SearchResultItem[] = [];
  const filters = opts?.filters;

  const statusLabels: Record<string, string> = {
    todo: "할 일",
    doing: "진행 중",
    on_hold: "보류",
    done: "완료",
  };
  const statusLabelsProject: Record<string, string> = {
    planning: "계획",
    active: "진행 중",
    on_hold: "보류",
    done: "완료",
    archived: "보관됨",
  };

  if (types.includes("event")) {
    const eventFilters = eventFilterSql(filters);
    const { results: events } = await db
      .prepare(
        `SELECT e.id, e.title, e.start_at, e.all_day, t.name as team_name
         FROM events e
         LEFT JOIN teams t ON t.id = e.team_id
         WHERE e.organization_id = ?
           AND (e.title LIKE ? OR COALESCE(e.description, '') LIKE ? OR COALESCE(e.location, '') LIKE ?)
           ${eventFilters.sql}
         ORDER BY e.start_at DESC
         LIMIT ?`,
      )
      .bind(orgId, pattern, pattern, pattern, ...eventFilters.binds, perType)
      .all();

    for (const row of events ?? []) {
      const r = row as Record<string, unknown>;
      const startAt = r.start_at as number;
      const dateLabel = (r.all_day as number) ? formatDateOnlyKst(startAt) : formatActivityTimeKst(startAt);
      results.push({
        id: r.id as string,
        type: "event",
        title: r.title as string,
        subtitle: `${dateLabel} · ${(r.team_name as string) ?? "일정"}`,
        link: `/calendar?event=${r.id}`,
      });
    }
  }

  if (types.includes("task")) {
    const taskFilters = taskFilterSql(filters);
    const { results: tasks } = await db
      .prepare(
        `SELECT t.id, t.title, t.status, t.due_at, u.name as assignee_name, p.name as project_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.organization_id = ?
           AND t.parent_task_id IS NULL
           AND (
             t.title LIKE ? OR COALESCE(t.description, '') LIKE ?
             OR EXISTS (
               SELECT 1 FROM task_label_assignments tla
               JOIN task_labels tl ON tl.id = tla.label_id
               WHERE tla.task_id = t.id AND tl.name LIKE ?
             )
           )
           ${taskFilters.sql}
         ORDER BY t.updated_at DESC
         LIMIT ?`,
      )
      .bind(orgId, pattern, pattern, pattern, ...taskFilters.binds, perType)
      .all();

    for (const row of tasks ?? []) {
      const r = row as Record<string, unknown>;
      const status = statusLabels[r.status as string] ?? (r.status as string);
      const assignee = (r.assignee_name as string) ?? "미배정";
      const projectName = r.project_name as string | null;
      results.push({
        id: r.id as string,
        type: "task",
        title: r.title as string,
        subtitle: projectName ? `${status} · ${projectName}` : `${status} · ${assignee}`,
        link: `/tasks?task=${r.id}`,
      });
    }
  }

  if (types.includes("project")) {
    const accessSql = memberProjectAccessSql(opts?.userId, opts?.orgRole);
    const projectBinds: unknown[] = [orgId, pattern, pattern];
    if (filters?.status) {
      projectBinds.push(filters.status);
    }
    if (filters?.teamId) {
      projectBinds.push(filters.teamId);
    }
    if (accessSql) projectBinds.push(opts!.userId!, opts!.userId!);
    projectBinds.push(perType);

    const { results: projects } = await db
      .prepare(
        `SELECT p.id, p.name, p.status, u.name as owner_name
         FROM projects p
         LEFT JOIN users u ON u.id = p.owner_id
         WHERE p.organization_id = ?
           AND (p.name LIKE ? OR COALESCE(p.description, '') LIKE ?)
           ${filters?.status ? " AND p.status = ?" : ""}
           ${filters?.teamId ? " AND p.team_id = ?" : ""}
           ${accessSql}
         ORDER BY p.updated_at DESC
         LIMIT ?`,
      )
      .bind(...projectBinds)
      .all();

    for (const row of projects ?? []) {
      const r = row as Record<string, unknown>;
      const status = statusLabelsProject[r.status as string] ?? (r.status as string);
      results.push({
        id: r.id as string,
        type: "project",
        title: r.name as string,
        subtitle: `${status} · ${(r.owner_name as string) ?? "담당자"}`,
        link: `/projects/${r.id}`,
      });
    }
  }

  if (types.includes("milestone")) {
    const accessSql = memberProjectAccessSql(opts?.userId, opts?.orgRole);
    const milestoneBinds: unknown[] = [orgId, pattern, pattern];
    if (filters?.projectId) milestoneBinds.push(filters.projectId);
    if (filters?.status) milestoneBinds.push(filters.status);
    if (filters?.dateFrom != null) milestoneBinds.push(filters.dateFrom);
    if (filters?.dateTo != null) milestoneBinds.push(filters.dateTo);
    if (accessSql) milestoneBinds.push(opts!.userId!, opts!.userId!);
    milestoneBinds.push(perType);

    const { results: milestones } = await db
      .prepare(
        `SELECT m.id, m.title, m.status, m.due_at, p.id as project_id, p.name as project_name
         FROM project_milestones m
         JOIN projects p ON p.id = m.project_id
         WHERE p.organization_id = ?
           AND (m.title LIKE ? OR COALESCE(m.description, '') LIKE ?)
           ${filters?.projectId ? " AND m.project_id = ?" : ""}
           ${filters?.status ? " AND m.status = ?" : ""}
           ${filters?.dateFrom != null ? " AND m.due_at IS NOT NULL AND m.due_at >= ?" : ""}
           ${filters?.dateTo != null ? " AND m.due_at IS NOT NULL AND m.due_at <= ?" : ""}
           ${accessSql}
         ORDER BY m.due_at ASC, m.updated_at DESC
         LIMIT ?`,
      )
      .bind(...milestoneBinds)
      .all();

    for (const row of milestones ?? []) {
      const r = row as Record<string, unknown>;
      const dueAt = r.due_at as number | null;
      const dueLabel = dueAt ? formatDateOnlyKst(dueAt) : "기한 없음";
      const status = r.status === "done" ? "완료" : "예정";
      results.push({
        id: r.id as string,
        type: "milestone",
        title: r.title as string,
        subtitle: `${(r.project_name as string) ?? "프로젝트"} · ${status} · ${dueLabel}`,
        link: `/projects/${r.project_id}?tab=milestones`,
      });
    }
  }

  if (types.includes("member")) {
    const { results: members } = await db
      .prepare(
        `SELECT u.id, u.name, u.email, m.role
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = ? AND m.status = 'active'
           AND (u.name LIKE ? OR COALESCE(u.email, '') LIKE ?)
         ORDER BY u.name
         LIMIT ?`,
      )
      .bind(orgId, pattern, pattern, perType)
      .all();

    for (const row of members ?? []) {
      const r = row as Record<string, unknown>;
      results.push({
        id: r.id as string,
        type: "member",
        title: r.name as string,
        subtitle: `${r.email ?? "이메일 없음"} · ${r.role}`,
        link: `/settings/members`,
      });
    }
  }

  if (types.includes("comment")) {
    const taskCommentFilters = taskFilterSql(filters);
    const { results: taskComments } = await db
      .prepare(
        `SELECT tc.id, tc.body, t.id as parent_id, t.title as parent_title
         FROM task_comments tc
         JOIN tasks t ON t.id = tc.task_id
         WHERE t.organization_id = ?
           AND tc.body LIKE ?
           ${taskCommentFilters.sql}
         ORDER BY tc.created_at DESC
         LIMIT ?`,
      )
      .bind(orgId, pattern, ...taskCommentFilters.binds, perType)
      .all();

    for (const row of taskComments ?? []) {
      const r = row as Record<string, unknown>;
      const body = (r.body as string) ?? "";
      results.push({
        id: r.id as string,
        type: "comment",
        title: body.length > 80 ? `${body.slice(0, 80)}…` : body,
        subtitle: `업무 댓글 · ${(r.parent_title as string) ?? ""}`,
        link: `/tasks?task=${r.parent_id}`,
      });
    }

    const eventCommentSql = filters?.teamId ? " AND e.team_id = ?" : "";
    const eventCommentBinds: unknown[] = [orgId, pattern];
    if (filters?.teamId) eventCommentBinds.push(filters.teamId);
    eventCommentBinds.push(perType);

    const { results: eventComments } = await db
      .prepare(
        `SELECT ec.id, ec.body, e.id as parent_id, e.title as parent_title
         FROM event_comments ec
         JOIN events e ON e.id = ec.event_id
         WHERE e.organization_id = ?
           AND ec.body LIKE ?
           ${eventCommentSql}
         ORDER BY ec.created_at DESC
         LIMIT ?`,
      )
      .bind(...eventCommentBinds)
      .all();

    for (const row of eventComments ?? []) {
      const r = row as Record<string, unknown>;
      const body = (r.body as string) ?? "";
      results.push({
        id: r.id as string,
        type: "comment",
        title: body.length > 80 ? `${body.slice(0, 80)}…` : body,
        subtitle: `일정 댓글 · ${(r.parent_title as string) ?? ""}`,
        link: `/calendar?event=${r.parent_id}`,
      });
    }

    const projectCommentSql = filters?.projectId ? " AND pc.project_id = ?" : "";
    const projectCommentBinds: unknown[] = [orgId, pattern];
    if (filters?.projectId) projectCommentBinds.push(filters.projectId);
    if (opts?.userId && opts?.orgRole && opts.orgRole !== "owner" && opts.orgRole !== "admin") {
      projectCommentBinds.push(opts.userId, opts.userId);
    }
    projectCommentBinds.push(perType);

    const projectAccessSql = memberProjectAccessSql(opts?.userId, opts?.orgRole);
    const { results: projectComments } = await db
      .prepare(
        `SELECT pc.id, pc.body, pc.project_id as parent_id, p.name as parent_title
         FROM project_comments pc
         JOIN projects p ON p.id = pc.project_id
         WHERE p.organization_id = ?
           AND pc.body LIKE ?
           ${projectCommentSql}
           ${projectAccessSql}
         ORDER BY pc.created_at DESC
         LIMIT ?`,
      )
      .bind(...projectCommentBinds)
      .all();

    for (const row of projectComments ?? []) {
      const r = row as Record<string, unknown>;
      const body = (r.body as string) ?? "";
      results.push({
        id: r.id as string,
        type: "comment",
        title: body.length > 80 ? `${body.slice(0, 80)}…` : body,
        subtitle: `프로젝트 댓글 · ${(r.parent_title as string) ?? ""}`,
        link: `/projects/${r.parent_id}?tab=overview`,
      });
    }
  }

  return results.slice(0, limit);
}
