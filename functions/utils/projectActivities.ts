import { formatActivityTimeKst, newId, now } from "./helpers";

export type ProjectActivityAction =
  | "created"
  | "updated"
  | "milestone_added"
  | "milestone_updated"
  | "milestone_done"
  | "milestone_removed"
  | "member_added"
  | "member_removed"
  | "ownership_transferred";

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "계획",
  active: "진행 중",
  on_hold: "보류",
  done: "완료",
  archived: "보관됨",
};

export async function insertProjectActivity(
  db: D1Database,
  opts: {
    projectId: string;
    organizationId: string;
    actorId: string;
    action: ProjectActivityAction;
    summary: string;
    field?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO project_activities (
         id, project_id, organization_id, actor_id, action, field, summary, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      opts.projectId,
      opts.organizationId,
      opts.actorId,
      opts.action,
      opts.field ?? null,
      opts.summary,
      now(),
    )
    .run();
}

export async function logProjectCreated(
  db: D1Database,
  orgId: string,
  projectId: string,
  actorId: string,
  name: string,
): Promise<void> {
  await insertProjectActivity(db, {
    projectId,
    organizationId: orgId,
    actorId,
    action: "created",
    summary: `프로젝트 생성 · ${name}`,
  });
}

export async function logProjectUpdated(
  db: D1Database,
  orgId: string,
  projectId: string,
  actorId: string,
  body: {
    name?: string;
    description?: string | null;
    status?: string;
    teamId?: string | null;
    startAt?: number | null;
    endAt?: number | null;
    visibility?: string;
    shareWithOrganization?: boolean;
  },
  before: {
    name: string;
    description: string | null;
    status: string;
    visibility?: string | null;
  },
): Promise<void> {
  const logs: { summary: string; field?: string }[] = [];
  if (body.name !== undefined && body.name.trim() !== before.name) {
    logs.push({ summary: `이름: ${before.name} → ${body.name.trim()}`, field: "name" });
  }
  if (body.description !== undefined && body.description !== before.description) {
    logs.push({ summary: "설명 변경", field: "description" });
  }
  if (body.status !== undefined && body.status !== before.status) {
    logs.push({
      summary: `상태: ${PROJECT_STATUS_LABELS[before.status] ?? before.status} → ${PROJECT_STATUS_LABELS[body.status] ?? body.status}`,
      field: "status",
    });
  }
  if (body.teamId !== undefined) logs.push({ summary: "팀 변경", field: "team" });
  if (body.startAt !== undefined || body.endAt !== undefined) {
    logs.push({ summary: "기간 변경", field: "dates" });
  }

  const nextVisibility =
    body.visibility ??
    (body.shareWithOrganization === undefined
      ? undefined
      : body.shareWithOrganization
        ? "organization"
        : "members");
  if (nextVisibility !== undefined && nextVisibility !== (before.visibility ?? "members")) {
    const beforeLabel = (before.visibility ?? "members") === "organization" ? "조직 공유" : "초대 멤버만";
    const afterLabel = nextVisibility === "organization" ? "조직 공유" : "초대 멤버만";
    logs.push({ summary: `공유: ${beforeLabel} → ${afterLabel}`, field: "visibility" });
  }

  for (const log of logs) {
    await insertProjectActivity(db, {
      projectId,
      organizationId: orgId,
      actorId,
      action: "updated",
      summary: log.summary,
      field: log.field,
    });
  }
}

export async function fetchProjectActivities(db: D1Database, projectId: string, limit = 50) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.project_id, a.actor_id, a.action, a.field, a.summary, a.created_at, u.name as actor_name
       FROM project_activities a
       JOIN users u ON u.id = a.actor_id
       WHERE a.project_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .bind(projectId, limit)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const createdAt = r.created_at as number;
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      actorId: r.actor_id as string,
      actorName: r.actor_name as string,
      action: r.action as string,
      field: (r.field as string | null) ?? null,
      summary: r.summary as string,
      createdAt,
      time: formatActivityTimeKst(createdAt),
    };
  });
}
