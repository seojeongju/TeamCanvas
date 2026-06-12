import { formatActivityTimeKst, formatDateOnlyKst } from "./helpers";
export type SearchResultType = "event" | "task" | "project" | "milestone" | "member";

export type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  link: string;
};

export type SearchOptions = {
  userId?: string;
  orgRole?: string;
  types?: SearchResultType[];
};

function memberProjectAccessSql(userId?: string, orgRole?: string): string {
  if (!userId || !orgRole || orgRole === "owner" || orgRole === "admin") return "";
  return ` AND (p.owner_id = ? OR EXISTS (
     SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?
   ))`;
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

  const types = opts?.types?.length ? opts.types : (["event", "task", "project", "milestone", "member"] as SearchResultType[]);
  const pattern = `%${q}%`;
  const perType = Math.max(4, Math.ceil(limit / types.length));
  const results: SearchResultItem[] = [];

  const statusLabels: Record<string, string> = { todo: "할 일", doing: "진행 중", done: "완료" };
  const statusLabelsProject: Record<string, string> = {
    planning: "계획",
    active: "진행 중",
    on_hold: "보류",
    done: "완료",
    archived: "보관됨",
  };

  if (types.includes("event")) {
    const { results: events } = await db
      .prepare(
        `SELECT e.id, e.title, e.start_at, e.all_day, t.name as team_name
         FROM events e
         LEFT JOIN teams t ON t.id = e.team_id
         WHERE e.organization_id = ?
           AND (e.title LIKE ? OR COALESCE(e.description, '') LIKE ? OR COALESCE(e.location, '') LIKE ?)
         ORDER BY e.start_at DESC
         LIMIT ?`,
      )
      .bind(orgId, pattern, pattern, pattern, perType)
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
    const { results: tasks } = await db
      .prepare(
        `SELECT t.id, t.title, t.status, t.due_at, u.name as assignee_name, p.name as project_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.organization_id = ?
           AND (t.title LIKE ? OR COALESCE(t.description, '') LIKE ?)
         ORDER BY t.updated_at DESC
         LIMIT ?`,
      )
      .bind(orgId, pattern, pattern, perType)
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
    if (accessSql) projectBinds.push(opts!.userId!, opts!.userId!);
    projectBinds.push(perType);

    const { results: projects } = await db
      .prepare(
        `SELECT p.id, p.name, p.status, u.name as owner_name
         FROM projects p
         LEFT JOIN users u ON u.id = p.owner_id
         WHERE p.organization_id = ?
           AND (p.name LIKE ? OR COALESCE(p.description, '') LIKE ?)
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
    if (accessSql) milestoneBinds.push(opts!.userId!, opts!.userId!);
    milestoneBinds.push(perType);

    const { results: milestones } = await db
      .prepare(
        `SELECT m.id, m.title, m.status, m.due_at, p.id as project_id, p.name as project_name
         FROM project_milestones m
         JOIN projects p ON p.id = m.project_id
         WHERE p.organization_id = ?
           AND (m.title LIKE ? OR COALESCE(m.description, '') LIKE ?)
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

  return results.slice(0, limit);
}
