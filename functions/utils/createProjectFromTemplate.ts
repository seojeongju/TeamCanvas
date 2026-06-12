import { logProjectCreated } from "./projectActivities";
import { logTaskCreated } from "./taskActivities";
import { resolveBuiltinTemplate } from "./builtinProjectTemplates";
import {
  dueAtFromOffset,
  parseTemplateMemberSlots,
  parseTemplateMilestones,
  parseTemplateTasks,
  type ResolvedProjectTemplatePayload,
} from "./projectTemplateData";
import { newId, now } from "./helpers";

const PROJECT_STATUSES = ["planning", "active", "on_hold", "done"] as const;

export type CreateProjectFromTemplateInput = {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  status?: string;
  color?: string;
  teamId?: string | null;
  startAt?: number | null;
  endAt?: number | null;
  templateId: string;
};

export type CreateProjectFromTemplateResult = {
  id: string;
  milestoneCount: number;
  taskCount: number;
  memberSlots: ResolvedProjectTemplatePayload["memberSlots"];
};

async function resolveOrgTemplate(
  db: D1Database,
  orgId: string,
  templateId: string,
): Promise<ResolvedProjectTemplatePayload | null> {
  const id = templateId.startsWith("org:") ? templateId.slice(4) : templateId;
  const row = await db
    .prepare(
      `SELECT id, name, description, milestones_json, tasks_json, member_slots_json
       FROM project_templates WHERE id = ? AND organization_id = ?`,
    )
    .bind(id, orgId)
    .first<Record<string, unknown>>();
  if (!row) return null;

  return {
    id: `org:${row.id as string}`,
    name: row.name as string,
    description: (row.description as string | null) ?? "",
    milestones: parseTemplateMilestones((row.milestones_json as string) ?? "[]"),
    tasks: parseTemplateTasks((row.tasks_json as string) ?? "[]"),
    memberSlots: parseTemplateMemberSlots((row.member_slots_json as string) ?? "[]"),
    source: "org",
  };
}

export async function resolveProjectTemplatePayload(
  db: D1Database,
  orgId: string,
  templateId: string,
): Promise<ResolvedProjectTemplatePayload | null> {
  if (templateId.startsWith("builtin:") || !templateId.includes(":")) {
    return resolveBuiltinTemplate(templateId);
  }
  if (templateId.startsWith("org:")) {
    return resolveOrgTemplate(db, orgId, templateId);
  }
  return resolveBuiltinTemplate(`builtin:${templateId}`);
}

export async function createProjectFromTemplate(
  db: D1Database,
  input: CreateProjectFromTemplateInput,
): Promise<CreateProjectFromTemplateResult> {
  const template = await resolveProjectTemplatePayload(db, input.orgId, input.templateId);
  if (!template) throw new Error("template_not_found");

  const status = PROJECT_STATUSES.includes(input.status as (typeof PROJECT_STATUSES)[number])
    ? input.status!
    : "planning";

  const projectId = newId();
  const ts = now();
  const startAt = input.startAt ?? null;

  await db
    .prepare(
      `INSERT INTO projects (
        id, organization_id, team_id, owner_id, name, description, status, color, start_at, end_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      projectId,
      input.orgId,
      input.teamId ?? null,
      input.userId,
      input.name.trim(),
      input.description?.trim() || null,
      status,
      input.color ?? "#4A9FE8",
      startAt,
      input.endAt ?? null,
      ts,
      ts,
    )
    .run();

  await db
    .prepare(`INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`)
    .bind(projectId, input.userId, ts)
    .run();

  let milestoneCount = 0;
  for (let i = 0; i < template.milestones.length; i++) {
    const m = template.milestones[i];
    const milestoneId = newId();
    await db
      .prepare(
        `INSERT INTO project_milestones (
          id, project_id, title, description, due_at, status, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        milestoneId,
        projectId,
        m.title,
        null,
        dueAtFromOffset(startAt, m.offsetDays),
        i,
        ts,
        ts,
      )
      .run();
    milestoneCount++;
  }

  let taskCount = 0;
  for (const task of template.tasks) {
    const taskId = newId();
    const taskStatus = task.status ?? "todo";
    await db
      .prepare(
        `INSERT INTO tasks (
          id, organization_id, team_id, project_id, creator_id, assignee_id, title, description,
          status, priority, due_at, event_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, NULL, ?, ?)`,
      )
      .bind(
        taskId,
        input.orgId,
        input.teamId ?? null,
        projectId,
        input.userId,
        input.userId,
        task.title,
        task.description ?? null,
        taskStatus,
        dueAtFromOffset(startAt, task.offsetDays),
        ts,
        ts,
      )
      .run();
    await logTaskCreated(db, input.orgId, taskId, input.userId, task.title);
    taskCount++;
  }

  await logProjectCreated(db, input.orgId, projectId, input.userId, input.name.trim());

  return {
    id: projectId,
    milestoneCount,
    taskCount,
    memberSlots: template.memberSlots,
  };
}
