import { insertTaskActivity } from "./taskActivities";
import { newId, now } from "./helpers";

type TaskRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  creator_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: string;
  due_at: number | null;
  project_id: string | null;
};

const TASK_TO_PROJECT_STATUS: Record<string, string> = {
  todo: "planning",
  doing: "active",
  done: "done",
};

export async function convertTaskToProject(
  db: D1Database,
  opts: {
    taskId: string;
    actorId: string;
    name?: string;
    includeChecklistAsMilestones?: boolean;
  },
): Promise<{ projectId: string; projectName: string }> {
  const task = await db
    .prepare(
      `SELECT id, organization_id, team_id, creator_id, assignee_id, title, description, status, due_at, project_id
       FROM tasks WHERE id = ?`,
    )
    .bind(opts.taskId)
    .first<TaskRow>();

  if (!task) throw new Error("not_found");
  if (task.project_id) throw new Error("already_linked");

  const orgId = task.organization_id;
  const projectName = opts.name?.trim() || task.title.trim();
  if (!projectName) throw new Error("name_required");

  const projectId = newId();
  const ts = now();
  const projectStatus = TASK_TO_PROJECT_STATUS[task.status] ?? "planning";
  const ownerId = opts.actorId;
  const includeChecklist = opts.includeChecklistAsMilestones !== false;

  await db
    .prepare(
      `INSERT INTO projects (
        id, organization_id, team_id, owner_id, name, description, status, color, start_at, end_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      projectId,
      orgId,
      task.team_id,
      ownerId,
      projectName,
      task.description?.trim() || null,
      projectStatus,
      "#4A9FE8",
      ts,
      task.due_at,
      ts,
      ts,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
    )
    .bind(projectId, ownerId, ts)
    .run();

  const assigneeId = task.assignee_id;
  if (assigneeId && assigneeId !== ownerId) {
    await db
      .prepare(
        `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)
         ON CONFLICT(project_id, user_id) DO NOTHING`,
      )
      .bind(projectId, assigneeId, ts)
      .run();
  }

  if (includeChecklist) {
    const { results: checklist } = await db
      .prepare(
        `SELECT title, sort_order FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order, created_at`,
      )
      .bind(task.id)
      .all<{ title: string; sort_order: number }>();

    for (let i = 0; i < (checklist ?? []).length; i++) {
      const item = checklist![i];
      if (!item.title?.trim()) continue;
      const milestoneId = newId();
      await db
        .prepare(
          `INSERT INTO project_milestones (
            id, project_id, title, description, due_at, status, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, NULL, 'pending', ?, ?, ?)`,
        )
        .bind(milestoneId, projectId, item.title.trim(), item.sort_order ?? i, ts, ts)
        .run();
    }
  }

  await db
    .prepare("UPDATE tasks SET project_id = ?, updated_at = ? WHERE id = ?")
    .bind(projectId, ts, task.id)
    .run();

  const { insertProjectActivity } = await import("./projectActivities");
  await insertProjectActivity(db, {
    projectId,
    organizationId: orgId,
    actorId: opts.actorId,
    action: "created",
    summary: `업무에서 전환 · ${task.title}`,
  });

  await insertTaskActivity(db, {
    taskId: task.id,
    organizationId: orgId,
    actorId: opts.actorId,
    action: "updated",
    summary: `프로젝트로 전환 · ${projectName}`,
    field: "project_id",
    newValue: projectId,
  });

  return { projectId, projectName };
}
