import { logProjectCreated } from "./projectActivities";
import { copyProjectWork } from "./copyProjectWork";
import { newId, now } from "./helpers";

export async function duplicateProject(
  db: D1Database,
  opts: {
    sourceProjectId: string;
    actorId: string;
    orgId: string;
    name?: string;
    includeTasks?: boolean;
    includeMilestones?: boolean;
    includeSchedules?: boolean;
  },
): Promise<{ id: string; milestoneCount: number; taskCount: number }> {
  const source = await db
    .prepare(
      `SELECT id, organization_id, team_id, name, description, status, color, start_at, end_at, visibility
       FROM projects WHERE id = ? AND organization_id = ?`,
    )
    .bind(opts.sourceProjectId, opts.orgId)
    .first<Record<string, unknown>>();
  if (!source) throw new Error("not_found");

  const projectId = newId();
  const ts = now();
  const newName = opts.name?.trim() || `${source.name as string} (복사)`;

  await db
    .prepare(
      `INSERT INTO projects (
        id, organization_id, team_id, owner_id, name, description, status, color, start_at, end_at, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      projectId,
      opts.orgId,
      source.team_id,
      opts.actorId,
      newName,
      source.description,
      source.color,
      source.start_at,
      source.end_at,
      (source.visibility as string) || "members",
      ts,
      ts,
    )
    .run();

  await db
    .prepare(`INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`)
    .bind(projectId, opts.actorId, ts)
    .run();

  let milestoneCount = 0;
  let taskCount = 0;

  if (opts.includeTasks !== false) {
    const copied = await copyProjectWork(db, {
      sourceProjectId: opts.sourceProjectId,
      targetProjectId: projectId,
      actorId: opts.actorId,
      orgId: opts.orgId,
      includeMilestones: opts.includeMilestones !== false,
      includeSchedules: opts.includeSchedules !== false,
      resetStatus: true,
      activitySummary: `「${source.name as string}」에서 복제됨`,
    });
    milestoneCount = copied.milestoneCount;
    taskCount = copied.taskCount + copied.subtaskCount;
  } else if (opts.includeMilestones !== false) {
    const copied = await copyProjectWork(db, {
      sourceProjectId: opts.sourceProjectId,
      targetProjectId: projectId,
      actorId: opts.actorId,
      orgId: opts.orgId,
      includeMilestones: true,
      includeSchedules: opts.includeSchedules !== false,
      resetStatus: true,
      activitySummary: `「${source.name as string}」에서 마일스톤 복제됨`,
    });
    milestoneCount = copied.milestoneCount;
  }

  await logProjectCreated(db, opts.orgId, projectId, opts.actorId, newName);

  return { id: projectId, milestoneCount, taskCount };
}
