export type SearchResultItem = {
  id: string;
  type: "event" | "task" | "member";
  title: string;
  subtitle: string;
  link: string;
};

export async function searchOrganization(
  db: D1Database,
  orgId: string,
  query: string,
  limit = 20,
): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;
  const perType = Math.max(5, Math.ceil(limit / 3));
  const results: SearchResultItem[] = [];

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
    const d = new Date(startAt);
    const dateLabel = (r.all_day as number)
      ? d.toLocaleDateString("ko-KR")
      : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    results.push({
      id: r.id as string,
      type: "event",
      title: r.title as string,
      subtitle: `${dateLabel} · ${(r.team_name as string) ?? "일정"}`,
      link: `/calendar`,
    });
  }

  const { results: tasks } = await db
    .prepare(
      `SELECT t.id, t.title, t.status, t.due_at, u.name as assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.organization_id = ?
         AND (t.title LIKE ? OR COALESCE(t.description, '') LIKE ?)
       ORDER BY t.updated_at DESC
       LIMIT ?`,
    )
    .bind(orgId, pattern, pattern, perType)
    .all();

  const statusLabels: Record<string, string> = { todo: "할 일", doing: "진행 중", done: "완료" };
  for (const row of tasks ?? []) {
    const r = row as Record<string, unknown>;
    const status = statusLabels[r.status as string] ?? (r.status as string);
    const assignee = (r.assignee_name as string) ?? "미배정";
    results.push({
      id: r.id as string,
      type: "task",
      title: r.title as string,
      subtitle: `${status} · ${assignee}`,
      link: `/tasks?task=${r.id}`,
    });
  }

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

  return results.slice(0, limit);
}
