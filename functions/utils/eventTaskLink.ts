/** 일정·업무 연결 검증 */
export async function validateTaskEventLink(
  db: D1Database,
  organizationId: string,
  eventId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!eventId) return { ok: true };

  const event = await db
    .prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();

  if (!event) return { ok: false, error: "일정을 찾을 수 없습니다." };
  if (event.organization_id !== organizationId) {
    return { ok: false, error: "같은 조직의 일정만 연결할 수 있습니다." };
  }
  return { ok: true };
}

export type LinkedTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: number | null;
  assignee: string;
};

export async function fetchLinkedTasks(
  db: D1Database,
  eventId: string,
  organizationId: string,
): Promise<LinkedTaskRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.due_at, u.name as assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.event_id = ? AND t.organization_id = ?
       ORDER BY t.created_at DESC`,
    )
    .bind(eventId, organizationId)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
      priority: (r.priority as string) ?? "medium",
      dueAt: (r.due_at as number | null) ?? null,
      assignee: (r.assignee_name as string) ?? "미배정",
    };
  });
}
