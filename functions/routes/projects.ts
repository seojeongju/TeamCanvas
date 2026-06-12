import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { requireOrgPermission } from "../utils/permissions";
import { requireOrgFeature } from "../utils/subscriptions";
import { newId, now } from "../utils/helpers";
import {
  assertProjectAccess,
  canDeleteProject,
  canProjectEditMeta,
  canProjectManageMembers,
  canProjectWriteContent,
  getProjectMemberRole,
  orgRoleSeesAllProjects,
  PROJECT_MEMBER_ACCESS_SQL,
  type ProjectMemberRole,
} from "../utils/projectAccess";

export const projectRoutes = new Hono<{ Bindings: Env }>();

async function requireProjectAccess(
  c: { env: Env; json: (data: unknown, status?: number) => Response },
  userId: string,
  orgRole: string,
  projectId: string,
  orgId: string,
): Promise<Response | null> {
  const ok = await assertProjectAccess(c.env.DB, userId, orgRole, projectId, orgId);
  if (!ok) return c.json({ error: "not found" }, 404);
  return null;
}

async function requireProjectRole(
  c: { env: Env; json: (data: unknown, status?: number) => Response },
  userId: string,
  orgRole: string,
  projectId: string,
  orgId: string,
  allowed: (role: ProjectMemberRole) => boolean,
): Promise<ProjectMemberRole | Response> {
  const role = await getProjectMemberRole(c.env.DB, userId, orgRole, projectId, orgId);
  if (role === null) return c.json({ error: "not found" }, 404);
  if (!allowed(role)) return c.json({ error: "forbidden" }, 403);
  return role;
}

const PROJECT_STATUSES = ["planning", "active", "on_hold", "done"] as const;
const MILESTONE_STATUSES = ["pending", "done"] as const;
const MEMBER_ROLES = ["owner", "manager", "member", "viewer"] as const;

function mapMilestoneRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    dueAt: (row.due_at as number | null) ?? null,
    status: row.status as string,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function mapProjectMemberRow(row: Record<string, unknown>) {
  return {
    userId: row.user_id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    role: row.role as string,
    joinedAt: row.joined_at as number,
  };
}

function computeProjectProgress(row: Record<string, unknown>) {
  const taskCount = Number(row.task_count ?? 0);
  const openTaskCount = Number(row.open_task_count ?? 0);
  const doneTaskCount = taskCount - openTaskCount;
  const milestoneCount = Number(row.milestone_count ?? 0);
  const doneMilestoneCount = Number(row.done_milestone_count ?? 0);

  const rates: number[] = [];
  if (taskCount > 0) rates.push((doneTaskCount / taskCount) * 100);
  if (milestoneCount > 0) rates.push((doneMilestoneCount / milestoneCount) * 100);

  const progressPercent =
    rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

  return { progressPercent, milestoneCount, doneMilestoneCount };
}

function mapProjectRow(row: Record<string, unknown>) {
  const progress = computeProjectProgress(row);
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
    milestoneCount: progress.milestoneCount,
    doneMilestoneCount: progress.doneMilestoneCount,
    progressPercent: progress.progressPercent,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

const PROJECT_SELECT = `
  SELECT p.*, u.name as owner_name, tm.name as team_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') as open_task_count,
    (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id) as milestone_count,
    (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id AND status = 'done') as done_milestone_count
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

  if (!orgRoleSeesAllProjects(member.role)) {
    sql += PROJECT_MEMBER_ACCESS_SQL;
    binds.push(user.id, user.id);
  }

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

  const { logProjectCreated } = await import("../utils/projectActivities");
  await logProjectCreated(c.env.DB, orgId, id, user.id, body.name.trim());

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

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const currentUserRole = await getProjectMemberRole(c.env.DB, user.id, member.role, projectId, orgId);

  return c.json({
    project: {
      ...mapProjectRow(row),
      currentUserRole,
      isOwner: row.owner_id === user.id,
    },
  });
});

projectRoutes.patch("/projects/:projectId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const existing = await getProjectOr404(c.env.DB, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const orgId = existing.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const roleCheck = await requireProjectRole(
    c,
    user.id,
    member.role,
    projectId,
    orgId,
    canProjectEditMeta,
  );
  if (roleCheck instanceof Response) return roleCheck;

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

  const { logProjectUpdated } = await import("../utils/projectActivities");
  await logProjectUpdated(
    c.env.DB,
    orgId,
    projectId,
    user.id,
    body,
    {
      name: existing.name as string,
      description: (existing.description as string | null) ?? null,
      status: existing.status as string,
    },
  );

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

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const canDelete = await canDeleteProject(c.env.DB, user.id, member.role, projectId);
  if (!canDelete) return c.json({ error: "forbidden" }, 403);

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();

  return c.json({ ok: true });
});

projectRoutes.post("/projects/:projectId/transfer-ownership", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const existing = await getProjectOr404(c.env.DB, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const orgId = existing.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  if (existing.owner_id !== user.id) return c.json({ error: "forbidden" }, 403);

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const body = await c.req.json<{ newOwnerId: string }>();
  if (!body.newOwnerId) return c.json({ error: "newOwnerId required" }, 400);
  if (body.newOwnerId === user.id) return c.json({ error: "already owner" }, 400);

  const orgMember = await c.env.DB.prepare(
    "SELECT 1 FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(orgId, body.newOwnerId)
    .first();
  if (!orgMember) return c.json({ error: "User not in organization" }, 400);

  const projectMember = await c.env.DB.prepare(
    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
  )
    .bind(projectId, body.newOwnerId)
    .first<{ role: string }>();
  if (!projectMember) return c.json({ error: "User is not a project member" }, 400);

  const newOwner = await c.env.DB.prepare("SELECT name FROM users WHERE id = ?")
    .bind(body.newOwnerId)
    .first<{ name: string }>();

  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE projects SET owner_id = ?, updated_at = ? WHERE id = ?").bind(
      body.newOwnerId,
      ts,
      projectId,
    ),
    c.env.DB.prepare(
      "UPDATE project_members SET role = 'owner' WHERE project_id = ? AND user_id = ?",
    ).bind(projectId, body.newOwnerId),
    c.env.DB.prepare(
      "UPDATE project_members SET role = 'manager' WHERE project_id = ? AND user_id = ?",
    ).bind(projectId, user.id),
  ]);

  const { insertProjectActivity } = await import("../utils/projectActivities");
  await insertProjectActivity(c.env.DB, {
    projectId,
    organizationId: orgId,
    actorId: user.id,
    action: "ownership_transferred",
    summary: `소유권 이전 · ${newOwner?.name ?? body.newOwnerId}`,
  });

  return c.json({ ok: true });
});

// ── Milestones ──

projectRoutes.get("/projects/:projectId/milestones", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order, due_at, created_at`,
  )
    .bind(projectId)
    .all();

  const milestones = (results ?? []).map((row) => mapMilestoneRow(row as Record<string, unknown>));
  return c.json({ milestones });
});

projectRoutes.post("/projects/:projectId/milestones", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const roleCheck = await requireProjectRole(
    c,
    user.id,
    member.role,
    projectId,
    orgId,
    canProjectWriteContent,
  );
  if (roleCheck instanceof Response) return roleCheck;

  const body = await c.req.json<{
    title: string;
    description?: string;
    dueAt?: number | null;
    sortOrder?: number;
  }>();

  if (!body.title?.trim()) return c.json({ error: "title required" }, 400);

  const id = newId();
  const ts = now();
  const maxOrder = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) as m FROM project_milestones WHERE project_id = ?",
  )
    .bind(projectId)
    .first<{ m: number }>();

  await c.env.DB.prepare(
    `INSERT INTO project_milestones (id, project_id, title, description, due_at, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      body.title.trim(),
      body.description?.trim() || null,
      body.dueAt ?? null,
      body.sortOrder ?? (maxOrder?.m ?? -1) + 1,
      ts,
      ts,
    )
    .run();

  const { insertProjectActivity } = await import("../utils/projectActivities");
  await insertProjectActivity(c.env.DB, {
    projectId,
    organizationId: orgId,
    actorId: user.id,
    action: "milestone_added",
    summary: `마일스톤 추가 · ${body.title.trim()}`,
  });

  return c.json({ id }, 201);
});

projectRoutes.patch("/milestones/:milestoneId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const milestoneId = c.req.param("milestoneId");

  const existing = await c.env.DB.prepare(
    `SELECT m.*, p.organization_id FROM project_milestones m
     JOIN projects p ON p.id = m.project_id WHERE m.id = ?`,
  )
    .bind(milestoneId)
    .first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "not found" }, 404);

  const orgId = existing.organization_id as string;
  const projectId = existing.project_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const roleCheck = await requireProjectRole(
    c,
    user.id,
    member.role,
    projectId,
    orgId,
    canProjectWriteContent,
  );
  if (roleCheck instanceof Response) return roleCheck;

  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    dueAt?: number | null;
    status?: string;
    sortOrder?: number;
  }>();

  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.title !== undefined) {
    if (!body.title.trim()) return c.json({ error: "title required" }, 400);
    updates.push("title = ?");
    binds.push(body.title.trim());
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    binds.push(body.description?.trim() || null);
  }
  if (body.dueAt !== undefined) {
    updates.push("due_at = ?");
    binds.push(body.dueAt);
    updates.push("due_reminder_sent_at = NULL");
  }
  if (body.status !== undefined) {
    if (!MILESTONE_STATUSES.includes(body.status as (typeof MILESTONE_STATUSES)[number])) {
      return c.json({ error: "invalid status" }, 400);
    }
    updates.push("status = ?");
    binds.push(body.status);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    binds.push(body.sortOrder);
  }

  if (updates.length === 0) return c.json({ ok: true });

  updates.push("updated_at = ?");
  binds.push(now(), milestoneId);

  await c.env.DB.prepare(`UPDATE project_milestones SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();

  const { insertProjectActivity } = await import("../utils/projectActivities");
  const title = (body.title?.trim() ?? existing.title) as string;
  if (body.status === "done" && existing.status !== "done") {
    await insertProjectActivity(c.env.DB, {
      projectId,
      organizationId: orgId,
      actorId: user.id,
      action: "milestone_done",
      summary: `마일스톤 완료 · ${title}`,
    });
  } else {
    await insertProjectActivity(c.env.DB, {
      projectId,
      organizationId: orgId,
      actorId: user.id,
      action: "milestone_updated",
      summary: `마일스톤 수정 · ${title}`,
    });
  }

  return c.json({ ok: true });
});

projectRoutes.delete("/milestones/:milestoneId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const milestoneId = c.req.param("milestoneId");

  const existing = await c.env.DB.prepare(
    `SELECT m.id, m.title, m.project_id, p.organization_id FROM project_milestones m
     JOIN projects p ON p.id = m.project_id WHERE m.id = ?`,
  )
    .bind(milestoneId)
    .first<{ id: string; title: string; project_id: string; organization_id: string }>();
  if (!existing) return c.json({ error: "not found" }, 404);

  const member = await requireOrgPermission(c, user.id, existing.organization_id, "projects:read");
  if (member instanceof Response) return member;

  const roleCheck = await requireProjectRole(
    c,
    user.id,
    member.role,
    existing.project_id,
    existing.organization_id,
    canProjectWriteContent,
  );
  if (roleCheck instanceof Response) return roleCheck;

  await c.env.DB.prepare("DELETE FROM project_milestones WHERE id = ?").bind(milestoneId).run();

  const { insertProjectActivity } = await import("../utils/projectActivities");
  await insertProjectActivity(c.env.DB, {
    projectId: existing.project_id,
    organizationId: existing.organization_id,
    actorId: user.id,
    action: "milestone_removed",
    summary: `마일스톤 삭제 · ${existing.title}`,
  });

  return c.json({ ok: true });
});

// ── Members ──

projectRoutes.get("/projects/:projectId/members", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT pm.user_id, pm.role, pm.joined_at, u.name, u.email, u.avatar_url
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, u.name`,
  )
    .bind(projectId)
    .all();

  const members = (results ?? []).map((row) => mapProjectMemberRow(row as Record<string, unknown>));
  return c.json({ members });
});

projectRoutes.post("/projects/:projectId/members", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const perm = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (perm instanceof Response) return perm;

  const actorRole = await requireProjectRole(
    c,
    user.id,
    perm.role,
    projectId,
    orgId,
    canProjectManageMembers,
  );
  if (actorRole instanceof Response) return actorRole;

  const body = await c.req.json<{ userId: string; role?: string }>();
  if (!body.userId) return c.json({ error: "userId required" }, 400);

  const orgMember = await c.env.DB.prepare(
    "SELECT 1 FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(orgId, body.userId)
    .first();
  if (!orgMember) return c.json({ error: "User not in organization" }, 400);

  const role = MEMBER_ROLES.includes(body.role as (typeof MEMBER_ROLES)[number])
    ? body.role
    : "member";
  if (role === "owner") return c.json({ error: "Cannot assign owner role" }, 400);
  if (role === "manager" && actorRole !== "owner") {
    return c.json({ error: "forbidden" }, 403);
  }

  const existingMember = await c.env.DB.prepare(
    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
  )
    .bind(projectId, body.userId)
    .first<{ role: string }>();
  if (existingMember?.role === "owner") {
    return c.json({ error: "Cannot change owner role" }, 400);
  }
  if (existingMember?.role === "manager" && actorRole !== "owner") {
    return c.json({ error: "forbidden" }, 403);
  }

  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`,
  )
    .bind(projectId, body.userId, role, ts)
    .run();

  const added = await c.env.DB.prepare("SELECT name FROM users WHERE id = ?")
    .bind(body.userId)
    .first<{ name: string }>();

  const { insertProjectActivity } = await import("../utils/projectActivities");
  await insertProjectActivity(c.env.DB, {
    projectId,
    organizationId: orgId,
    actorId: user.id,
    action: "member_added",
    summary: `멤버 추가 · ${added?.name ?? body.userId}`,
  });

  return c.json({ ok: true }, 201);
});

projectRoutes.delete("/projects/:projectId/members/:userId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");
  const targetUserId = c.req.param("userId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const perm = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (perm instanceof Response) return perm;

  const actorRole = await requireProjectRole(
    c,
    user.id,
    perm.role,
    projectId,
    orgId,
    canProjectManageMembers,
  );
  if (actorRole instanceof Response) return actorRole;

  const target = await c.env.DB.prepare(
    `SELECT pm.role, u.name FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ? AND pm.user_id = ?`,
  )
    .bind(projectId, targetUserId)
    .first<{ role: string; name: string }>();
  if (!target) return c.json({ error: "not found" }, 404);
  if (target.role === "owner") return c.json({ error: "Cannot remove project owner" }, 400);
  if (target.role === "manager" && actorRole !== "owner") {
    return c.json({ error: "forbidden" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?")
    .bind(projectId, targetUserId)
    .run();

  const { insertProjectActivity } = await import("../utils/projectActivities");
  await insertProjectActivity(c.env.DB, {
    projectId,
    organizationId: orgId,
    actorId: user.id,
    action: "member_removed",
    summary: `멤버 제외 · ${target.name}`,
  });

  return c.json({ ok: true });
});

// ── Activities ──

projectRoutes.get("/projects/:projectId/activities", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const { fetchProjectActivities } = await import("../utils/projectActivities");
  const activities = await fetchProjectActivities(c.env.DB, projectId);
  return c.json({ activities });
});

// ── Files ──

projectRoutes.get("/projects/:projectId/files", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const projectId = c.req.param("projectId");

  const project = await getProjectOr404(c.env.DB, projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const orgId = project.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const access = await requireProjectAccess(c, user.id, member.role, projectId, orgId);
  if (access) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT id, filename, mime_type, size_bytes, created_at
     FROM files WHERE organization_id = ? AND entity_type = 'project' AND entity_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(orgId, projectId)
    .all();

  const files = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      filename: r.filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    };
  });

  return c.json({ files });
});

// ── Org project templates ──

function parseTemplateMilestones(json: string): { title: string; offsetDays?: number }[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is { title: string; offsetDays?: number } => typeof m === "object" && m !== null && "title" in m)
      .map((m) => ({
        title: String(m.title),
        offsetDays: typeof m.offsetDays === "number" ? m.offsetDays : undefined,
      }));
  } catch {
    return [];
  }
}

function mapTemplateRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    milestones: parseTemplateMilestones(row.milestones_json as string),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

projectRoutes.get("/organizations/:orgId/project-templates", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const member = await requireOrgPermission(c, user.id, orgId, "projects:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM project_templates WHERE organization_id = ? ORDER BY updated_at DESC`,
  )
    .bind(orgId)
    .all();

  const templates = (results ?? []).map((row) => mapTemplateRow(row as Record<string, unknown>));
  return c.json({ templates });
});

projectRoutes.post("/organizations/:orgId/project-templates", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const member = await requireOrgPermission(c, user.id, orgId, "projects:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{
    name: string;
    description?: string;
    milestones?: { title: string; offsetDays?: number }[];
  }>();

  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);

  const id = newId();
  const ts = now();
  const milestonesJson = JSON.stringify(
    (body.milestones ?? []).filter((m) => m.title?.trim()).map((m) => ({
      title: m.title.trim(),
      offsetDays: m.offsetDays,
    })),
  );

  await c.env.DB.prepare(
    `INSERT INTO project_templates (id, organization_id, name, description, milestones_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, orgId, body.name.trim(), body.description?.trim() || null, milestonesJson, user.id, ts, ts)
    .run();

  return c.json({ id }, 201);
});

projectRoutes.patch("/project-templates/:templateId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const templateId = c.req.param("templateId");

  const existing = await c.env.DB.prepare("SELECT organization_id FROM project_templates WHERE id = ?")
    .bind(templateId)
    .first<{ organization_id: string }>();
  if (!existing) return c.json({ error: "not found" }, 404);

  const member = await requireOrgPermission(c, user.id, existing.organization_id, "projects:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    milestones?: { title: string; offsetDays?: number }[];
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
  if (body.milestones !== undefined) {
    updates.push("milestones_json = ?");
    binds.push(
      JSON.stringify(
        body.milestones.filter((m) => m.title?.trim()).map((m) => ({
          title: m.title.trim(),
          offsetDays: m.offsetDays,
        })),
      ),
    );
  }

  if (updates.length === 0) return c.json({ ok: true });

  updates.push("updated_at = ?");
  binds.push(now(), templateId);

  await c.env.DB.prepare(`UPDATE project_templates SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();

  return c.json({ ok: true });
});

projectRoutes.post("/tasks/:taskId/convert-to-project", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare(
    "SELECT organization_id, project_id FROM tasks WHERE id = ?",
  )
    .bind(taskId)
    .first<{ organization_id: string; project_id: string | null }>();
  if (!task) return c.json({ error: "not found" }, 404);
  if (task.project_id) return c.json({ error: "already_linked" }, 400);

  const orgId = task.organization_id;
  const taskPerm = await requireOrgPermission(c, user.id, orgId, "tasks:write");
  if (taskPerm instanceof Response) return taskPerm;
  const projectPerm = await requireOrgPermission(c, user.id, orgId, "projects:write");
  if (projectPerm instanceof Response) return projectPerm;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const body = await c.req
    .json<{ name?: string; includeChecklistAsMilestones?: boolean }>()
    .catch(() => ({} as { name?: string; includeChecklistAsMilestones?: boolean }));

  const { convertTaskToProject } = await import("../utils/convertTaskToProject");
  try {
    const result = await convertTaskToProject(c.env.DB, {
      taskId,
      actorId: user.id,
      name: body.name,
      includeChecklistAsMilestones: body.includeChecklistAsMilestones,
    });
    return c.json(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "convert_failed";
    if (message === "not_found") return c.json({ error: "not found" }, 404);
    if (message === "already_linked") return c.json({ error: "already_linked" }, 400);
    if (message === "name_required") return c.json({ error: "name required" }, 400);
    throw err;
  }
});

projectRoutes.delete("/project-templates/:templateId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const templateId = c.req.param("templateId");

  const existing = await c.env.DB.prepare("SELECT organization_id FROM project_templates WHERE id = ?")
    .bind(templateId)
    .first<{ organization_id: string }>();
  if (!existing) return c.json({ error: "not found" }, 404);

  const member = await requireOrgPermission(c, user.id, existing.organization_id, "projects:write");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM project_templates WHERE id = ?").bind(templateId).run();
  return c.json({ ok: true });
});
