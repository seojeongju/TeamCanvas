import { newId, now } from "./helpers";

export type TaskActivityAction =
  | "created"
  | "updated"
  | "comment"
  | "checklist_add"
  | "checklist_done"
  | "checklist_remove"
  | "labels";

type TaskSnapshot = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: number | null;
  assignee_id: string | null;
  team_id: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

function formatDue(ts: number | null): string {
  if (!ts) return "없음";
  return new Date(ts).toLocaleDateString("ko-KR");
}

async function userName(db: D1Database, userId: string | null): Promise<string> {
  if (!userId) return "미배정";
  const row = await db.prepare("SELECT name FROM users WHERE id = ?").bind(userId).first<{ name: string }>();
  return row?.name ?? "알 수 없음";
}

async function teamName(db: D1Database, teamId: string | null): Promise<string> {
  if (!teamId) return "팀 없음";
  const row = await db.prepare("SELECT name FROM teams WHERE id = ?").bind(teamId).first<{ name: string }>();
  return row?.name ?? "알 수 없음";
}

export async function insertTaskActivity(
  db: D1Database,
  opts: {
    taskId: string;
    organizationId: string;
    actorId: string;
    action: TaskActivityAction;
    summary: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO task_activities (
         id, task_id, organization_id, actor_id, action, field, old_value, new_value, summary, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      opts.taskId,
      opts.organizationId,
      opts.actorId,
      opts.action,
      opts.field ?? null,
      opts.oldValue ?? null,
      opts.newValue ?? null,
      opts.summary,
      now(),
    )
    .run();
}

export async function logTaskCreated(
  db: D1Database,
  orgId: string,
  taskId: string,
  actorId: string,
  title: string,
): Promise<void> {
  await insertTaskActivity(db, {
    taskId,
    organizationId: orgId,
    actorId,
    action: "created",
    summary: `프로젝트 생성 · ${title}`,
  });
}

export async function logTaskUpdates(
  db: D1Database,
  orgId: string,
  taskId: string,
  actorId: string,
  before: TaskSnapshot,
  body: {
    status?: string;
    title?: string;
    description?: string | null;
    dueAt?: number | null;
    assigneeId?: string | null;
    priority?: string;
    teamId?: string | null;
  },
): Promise<void> {
  const logs: Array<{ field: string; summary: string; oldValue: string; newValue: string }> = [];

  if (body.title !== undefined && body.title.trim() !== before.title) {
    logs.push({
      field: "title",
      summary: `제목: ${before.title} → ${body.title.trim()}`,
      oldValue: before.title,
      newValue: body.title.trim(),
    });
  }
  if (body.description !== undefined && body.description !== before.description) {
    logs.push({
      field: "description",
      summary: "설명 수정",
      oldValue: before.description ?? "",
      newValue: body.description ?? "",
    });
  }
  if (body.status !== undefined && body.status !== before.status) {
    logs.push({
      field: "status",
      summary: `상태: ${STATUS_LABELS[before.status] ?? before.status} → ${STATUS_LABELS[body.status] ?? body.status}`,
      oldValue: before.status,
      newValue: body.status,
    });
  }
  if (body.priority !== undefined && body.priority !== before.priority) {
    logs.push({
      field: "priority",
      summary: `우선순위: ${PRIORITY_LABELS[before.priority] ?? before.priority} → ${PRIORITY_LABELS[body.priority] ?? body.priority}`,
      oldValue: before.priority,
      newValue: body.priority,
    });
  }
  if (body.dueAt !== undefined && body.dueAt !== before.due_at) {
    logs.push({
      field: "due_at",
      summary: `마감일: ${formatDue(before.due_at)} → ${formatDue(body.dueAt)}`,
      oldValue: before.due_at != null ? String(before.due_at) : "",
      newValue: body.dueAt != null ? String(body.dueAt) : "",
    });
  }
  if (body.assigneeId !== undefined && body.assigneeId !== before.assignee_id) {
    const [oldName, newName] = await Promise.all([
      userName(db, before.assignee_id),
      userName(db, body.assigneeId),
    ]);
    logs.push({
      field: "assignee_id",
      summary: `담당자: ${oldName} → ${newName}`,
      oldValue: before.assignee_id ?? "",
      newValue: body.assigneeId ?? "",
    });
  }
  if (body.teamId !== undefined && body.teamId !== before.team_id) {
    const [oldTeam, newTeam] = await Promise.all([
      teamName(db, before.team_id),
      teamName(db, body.teamId),
    ]);
    logs.push({
      field: "team_id",
      summary: `팀: ${oldTeam} → ${newTeam}`,
      oldValue: before.team_id ?? "",
      newValue: body.teamId ?? "",
    });
  }

  for (const log of logs) {
    await insertTaskActivity(db, {
      taskId,
      organizationId: orgId,
      actorId,
      action: "updated",
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      summary: log.summary,
    });
  }
}

export async function logTaskLabelsUpdated(
  db: D1Database,
  orgId: string,
  taskId: string,
  actorId: string,
): Promise<void> {
  await insertTaskActivity(db, {
    taskId,
    organizationId: orgId,
    actorId,
    action: "labels",
    summary: "라벨 변경",
  });
}

export async function fetchTaskActivities(db: D1Database, taskId: string, limit = 50) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.task_id, a.actor_id, a.action, a.field, a.summary, a.created_at, u.name as actor_name
       FROM task_activities a
       JOIN users u ON u.id = a.actor_id
       WHERE a.task_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .bind(taskId, limit)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const createdAt = r.created_at as number;
    return {
      id: r.id as string,
      taskId: r.task_id as string,
      actorId: r.actor_id as string,
      actorName: r.actor_name as string,
      action: r.action as string,
      field: (r.field as string | null) ?? null,
      summary: r.summary as string,
      createdAt,
      time: new Date(createdAt).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
}
