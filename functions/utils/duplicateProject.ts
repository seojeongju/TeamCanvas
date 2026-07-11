import { insertProjectActivity, logProjectCreated } from "./projectActivities";
import { newId, now } from "./helpers";

export async function duplicateProject(
  db: D1Database,
  opts: {
    sourceProjectId: string;
    actorId: string;
    orgId: string;
    name?: string;
    includeTasks?: boolean;
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

  const { results: milestones } = await db
    .prepare(
      `SELECT title, description, due_at, sort_order FROM project_milestones
       WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .bind(opts.sourceProjectId)
    .all();

  let milestoneCount = 0;
  for (const row of milestones ?? []) {
    const m = row as Record<string, unknown>;
    await db
      .prepare(
        `INSERT INTO project_milestones (
          id, project_id, title, description, due_at, status, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        newId(),
        projectId,
        m.title,
        m.description,
        m.due_at,
        m.sort_order ?? milestoneCount,
        ts,
        ts,
      )
      .run();
    milestoneCount++;
  }

  let taskCount = 0;
  if (opts.includeTasks !== false) {
    const { results: tasks } = await db
      .prepare(
        `SELECT title, description, priority, due_at, sort_order FROM tasks
         WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(opts.sourceProjectId)
      .all();

    for (const row of tasks ?? []) {
      const t = row as Record<string, unknown>;
      await db
        .prepare(
          `INSERT INTO tasks (
            id, organization_id, team_id, project_id, creator_id, assignee_id, title, description,
            status, priority, due_at, event_id, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, NULL, ?, ?, ?)`,
        )
        .bind(
          newId(),
          opts.orgId,
          source.team_id,
          projectId,
          opts.actorId,
          opts.actorId,
          t.title,
          t.description,
          t.priority ?? "medium",
          t.due_at,
          t.sort_order ?? taskCount,
          ts,
          ts,
        )
        .run();
      taskCount++;
    }
  }

  await logProjectCreated(db, opts.orgId, projectId, opts.actorId, newName);
  await insertProjectActivity(db, {
    projectId,
    organizationId: opts.orgId,
    actorId: opts.actorId,
    action: "created",
    summary: `「${source.name as string}」에서 복제됨`,
    field: "duplicate",
  });

  return { id: projectId, milestoneCount, taskCount };
}
