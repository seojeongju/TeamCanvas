import { orgRoleSeesAllProjects } from "./projectAccess";

export const COLLABORATION_DELETE_MESSAGE =
  "다른 사람과 연결된 항목은 관리자만 삭제할 수 있습니다.";

export function isOrgAdmin(role: string): boolean {
  return orgRoleSeesAllProjects(role);
}

export async function eventHasCollaborationLinks(
  db: D1Database,
  eventId: string,
  creatorId: string,
): Promise<boolean> {
  const otherAttendee = await db
    .prepare(
      `SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id != ? LIMIT 1`,
    )
    .bind(eventId, creatorId)
    .first();
  if (otherAttendee) return true;

  const linkedTask = await db
    .prepare(
      `SELECT 1 FROM tasks
       WHERE event_id = ?
         AND assignee_id IS NOT NULL
         AND assignee_id != ?
       LIMIT 1`,
    )
    .bind(eventId, creatorId)
    .first();
  if (linkedTask) return true;

  const milestone = await db
    .prepare(`SELECT 1 FROM project_milestones WHERE calendar_event_id = ? LIMIT 1`)
    .bind(eventId)
    .first();
  if (milestone) return true;

  return false;
}

export async function taskHasCollaborationLinks(
  db: D1Database,
  taskId: string,
  creatorId: string,
): Promise<boolean> {
  const task = await db
    .prepare(
      `SELECT assignee_id, event_id, project_id FROM tasks WHERE id = ?`,
    )
    .bind(taskId)
    .first<{
      assignee_id: string | null;
      event_id: string | null;
      project_id: string | null;
    }>();
  if (!task) return false;

  if (task.assignee_id && task.assignee_id !== creatorId) return true;

  if (task.event_id) {
    const event = await db
      .prepare(`SELECT creator_id FROM events WHERE id = ?`)
      .bind(task.event_id)
      .first<{ creator_id: string }>();
    if (!event) return true;
    if (event.creator_id !== creatorId) return true;
    if (await eventHasCollaborationLinks(db, task.event_id, event.creator_id)) return true;
  }

  if (task.project_id) {
    const project = await db
      .prepare(`SELECT owner_id FROM projects WHERE id = ?`)
      .bind(task.project_id)
      .first<{ owner_id: string }>();
    if (!project) return true;

    const otherMember = await db
      .prepare(
        `SELECT 1 FROM project_members
         WHERE project_id = ? AND user_id != ?
         LIMIT 1`,
      )
      .bind(task.project_id, project.owner_id)
      .first();
    if (otherMember) return true;

    const otherTask = await db
      .prepare(
        `SELECT 1 FROM tasks
         WHERE project_id = ?
           AND id != ?
           AND (
             (assignee_id IS NOT NULL AND assignee_id != ?)
             OR creator_id != ?
           )
         LIMIT 1`,
      )
      .bind(task.project_id, taskId, creatorId, creatorId)
      .first();
    if (otherTask) return true;
  }

  return false;
}

export async function projectHasCollaborationLinks(
  db: D1Database,
  projectId: string,
  ownerId: string,
): Promise<boolean> {
  const otherMember = await db
    .prepare(
      `SELECT 1 FROM project_members WHERE project_id = ? AND user_id != ? LIMIT 1`,
    )
    .bind(projectId, ownerId)
    .first();
  if (otherMember) return true;

  const otherTask = await db
    .prepare(
      `SELECT 1 FROM tasks
       WHERE project_id = ?
         AND (
           (assignee_id IS NOT NULL AND assignee_id != ?)
           OR creator_id != ?
         )
       LIMIT 1`,
    )
    .bind(projectId, ownerId, ownerId)
    .first();
  if (otherTask) return true;

  return false;
}

export type DeleteAuthorization =
  | { allowed: true }
  | { allowed: false; status: 403 | 404; error: string };

export async function authorizeEventDelete(
  db: D1Database,
  userId: string,
  orgRole: string,
  event: { id: string; creator_id: string },
): Promise<DeleteAuthorization> {
  if (isOrgAdmin(orgRole)) return { allowed: true };

  if (event.creator_id !== userId) {
    return { allowed: false, status: 403, error: "삭제 권한이 없습니다." };
  }

  if (await eventHasCollaborationLinks(db, event.id, event.creator_id)) {
    return { allowed: false, status: 403, error: COLLABORATION_DELETE_MESSAGE };
  }

  return { allowed: true };
}

export async function authorizeTaskDelete(
  db: D1Database,
  userId: string,
  orgRole: string,
  task: { id: string; creator_id: string },
): Promise<DeleteAuthorization> {
  if (isOrgAdmin(orgRole)) return { allowed: true };

  if (task.creator_id !== userId) {
    return { allowed: false, status: 403, error: "삭제 권한이 없습니다." };
  }

  if (await taskHasCollaborationLinks(db, task.id, task.creator_id)) {
    return { allowed: false, status: 403, error: COLLABORATION_DELETE_MESSAGE };
  }

  return { allowed: true };
}

export async function authorizeProjectDelete(
  db: D1Database,
  userId: string,
  orgRole: string,
  project: { id: string; owner_id: string },
): Promise<DeleteAuthorization> {
  if (isOrgAdmin(orgRole)) return { allowed: true };

  if (project.owner_id !== userId) {
    return { allowed: false, status: 403, error: "삭제 권한이 없습니다." };
  }

  if (await projectHasCollaborationLinks(db, project.id, project.owner_id)) {
    return { allowed: false, status: 403, error: COLLABORATION_DELETE_MESSAGE };
  }

  return { allowed: true };
}
