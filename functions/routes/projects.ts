import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { requireOrgPermission } from "../utils/permissions";
import { requireOrgFeature } from "../utils/subscriptions";
import { newId, now } from "../utils/helpers";

export const projectRoutes = new Hono<{ Bindings: Env }>();

const PROJECT_STATUSES = ["planning", "active", "on_hold", "done"] as const;

function mapProjectRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    teamId: (row.team_id as string | null) ?? null,
    teamName: (row.team_name as string | null) ?? null,
    ownerId: row.owner_id as string,
    ownerName: row.owner_name as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    color: row.color as string,
    startAt: (row.start_at as number | null) ?? null,
    endAt: (row.end_at as number | null) ?? null,
    taskCount: Number(row.task_count ?? 0),
    openTaskCount: Number(row.open_task_count ?? 0),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

const PROJECT_SELECT = `
  SELECT p.*, u.name as owner_name, tm.name as team_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') as open_task_count
  FROM projects p
  LEFT JOIN users u ON u.id = p.owner_id
  LEFT JOIN teams tm ON tm.id = p.team_id
`;

async function getProjectOr404(db: D1Database, projectId: string) {
  const row = await db
    .prepare(`${PROJECT_SELECT} WHERE p.id = ?`)
    .bind(projectId)
    .first<Record<string, unknown>>();
  return row ?? null;
}

projectRoutes.get("/organizations/:orgId/projects", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const status = c.req.query("status");
  const teamId = c.req.query("teamId");

  let sql = `${PROJECT_SELECT} WHERE p.organization_id = ?`;
  const binds: unknown[] = [orgId];

  if (status && PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) {
    sql += " AND p.status = ?";
    binds.push(status);
  }
  if (teamId) {
    sql += " AND p.team_id = ?";
    binds.push(teamId);
  }

  sql += " ORDER BY p.updated_at DESC";

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  const projects = (results ?? []).map((row) => mapProjectRow(row as Record<string, unknown>));

  return c.json({ projects });
});

projectRoutes.post("/organizations/:orgId/projects", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const member = await requireOrgPermission(c, user.id, orgId, "projects:write");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const body = await c.req.json<{
    name: string;
    description?: string;
    status?: string;
    color?: string;
    teamId?: string | null;
    startAt?: number | null;
    endAt?: number | null;
  }>();

  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);

  const status = PROJECT_STATUSES.includes(body.status as (typeof PROJECT_STATUSES)[number])
    ? body.status
    : "planning";

  const id = newId();
  const ts = now();

  await c.env.DB.prepare(
    `INSERT INTO projects (
      id, organization_id, team_id, owner_id, name, description, status, color, start_at, end_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      body.teamId ?? null,
      user.id,
      body.name.trim(),
      body.description?.trim() || null,
      status,
      body.color ?? "#4A9FE8",
      body.startAt ?? null,
      body.endAt ?? null,
      ts,
      ts,
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
  )
    .bind(id, user.id, ts)
    .run();

  return c.json({ id }, 201);
});

projectRoutes.get("/projects/:projectId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const row = await getProjectOr404(c.env.DB, projectId);
  if (!row) return c.json({ error: "not found" }, 404);

  const orgId = row.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  return c.json({ project: mapProjectRow(row) });
});

projectRoutes.patch("/projects/:projectId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const existing = await getProjectOr404(c.env.DB, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const orgId = existing.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:write");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    status?: string;
    color?: string;
    teamId?: string | null;
    startAt?: number | null;
    endAt?: number | null;
  }>();

  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: "name required" }, 400);
    updates.push("name = ?");
    binds.push(body.name.trim());
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    binds.push(body.description?.trim() || null);
  }
  if (body.status !== undefined) {
    if (!PROJECT_STATUSES.includes(body.status as (typeof PROJECT_STATUSES)[number])) {
      return c.json({ error: "invalid status" }, 400);
    }
    updates.push("status = ?");
    binds.push(body.status);
  }
  if (body.color !== undefined) {
    updates.push("color = ?");
    binds.push(body.color);
  }
  if (body.teamId !== undefined) {
    updates.push("team_id = ?");
    binds.push(body.teamId);
  }
  if (body.startAt !== undefined) {
    updates.push("start_at = ?");
    binds.push(body.startAt);
  }
  if (body.endAt !== undefined) {
    updates.push("end_at = ?");
    binds.push(body.endAt);
  }

  if (updates.length === 0) return c.json({ ok: true });

  updates.push("updated_at = ?");
  binds.push(now());
  binds.push(projectId);

  await c.env.DB.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();

  return c.json({ ok: true });
});

projectRoutes.delete("/projects/:projectId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const existing = await getProjectOr404(c.env.DB, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const orgId = existing.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:delete");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();

  return c.json({ ok: true });
});
