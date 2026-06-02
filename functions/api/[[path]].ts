import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { requireOrgPermission } from "../utils/permissions";
import { requireOrgFeature } from "../utils/subscriptions";
import {
  createOrganization,
  getUserOrganizations,
  getOrgStats,
} from "../utils/db";
import { adminRoutes } from "../routes/admin";
import { orgAdminRoutes } from "../routes/orgAdmin";
import { billingRoutes } from "../routes/billing";
import {
  newId,
  now,
  slugify,
  startOfDay,
  endOfDay,
  formatEventTime,
} from "../utils/helpers";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.route("/admin", adminRoutes);
app.route("/", orgAdminRoutes);
app.route("/", billingRoutes);

app.get("/health", async (c) => {
  let dbStatus = "ok";
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    dbStatus = "error";
  }
  return c.json({ status: "ok", service: "teamcanvas", db: dbStatus, timestamp: new Date().toISOString() });
});

// ── Organizations ──

app.get("/organizations", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const organizations = await getUserOrganizations(c.env.DB, user.id);
  return c.json({ organizations });
});

app.post("/organizations", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const body = await c.req.json<{ name: string; slug?: string }>();
  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);

  const membershipCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as c FROM memberships WHERE user_id = ? AND status = 'active'",
  )
    .bind(user.id)
    .first<{ c: number }>();
  if ((membershipCount?.c ?? 0) > 0) {
    return c.json({ error: "A user can belong to only one organization." }, 409);
  }

  let slug = body.slug?.trim() || slugify(body.name);
  const existing = await c.env.DB.prepare("SELECT id FROM organizations WHERE slug = ?")
    .bind(slug)
    .first();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const org = await createOrganization(c.env.DB, user.id, body.name.trim(), slug);
  return c.json({ organization: org }, 201);
});

app.get("/organizations/:orgId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (member instanceof Response) return member;

  const org = await c.env.DB.prepare(
    "SELECT id, name, slug, timezone FROM organizations WHERE id = ?",
  )
    .bind(orgId)
    .first<{ id: string; name: string; slug: string; timezone: string }>();

  if (!org) return c.json({ error: "Not found" }, 404);
  const stats = await getOrgStats(c.env.DB, orgId);
  return c.json({ organization: { ...org, role: member.role }, stats });
});

// ── Events ──

app.get("/organizations/:orgId/events", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const from = Number(c.req.query("from") ?? startOfDay(now()));
  const to = Number(c.req.query("to") ?? endOfDay(now()) + 86400000 * 30);

  const { results } = await c.env.DB.prepare(
    `SELECT e.*, t.name as team_name
     FROM events e
     LEFT JOIN teams t ON t.id = e.team_id
     WHERE e.organization_id = ? AND e.start_at < ? AND e.end_at > ?
     ORDER BY e.start_at ASC`,
  )
    .bind(orgId, to, from)
    .all();

  const events = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      startAt: r.start_at,
      endAt: r.end_at,
      allDay: Boolean(r.all_day),
      visibility: r.visibility,
      color: r.color ?? "#4A9FE8",
      teamName: r.team_name ?? "조직",
      time: formatEventTime(r.start_at as number, r.end_at as number, Boolean(r.all_day)),
    };
  });

  return c.json({ events });
});

app.post("/organizations/:orgId/events", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:write");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const body = await c.req.json<{
    title: string;
    description?: string;
    startAt: number;
    endAt: number;
    allDay?: boolean;
    teamId?: string;
    color?: string;
  }>();

  if (!body.title?.trim() || !body.startAt || !body.endAt) {
    return c.json({ error: "title, startAt, endAt required" }, 400);
  }

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO events (id, organization_id, team_id, creator_id, title, description, start_at, end_at, all_day, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      body.teamId ?? null,
      user.id,
      body.title.trim(),
      body.description ?? null,
      body.startAt,
      body.endAt,
      body.allDay ? 1 : 0,
      body.color ?? "#4A9FE8",
      ts,
      ts,
    )
    .run();

  return c.json({ id }, 201);
});

app.delete("/events/:eventId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare(
    "SELECT organization_id FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:delete");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();
  return c.json({ ok: true });
});

// ── Tasks ──

app.get("/organizations/:orgId/tasks", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "tasks:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.organization_id = ?
     ORDER BY t.sort_order, t.created_at DESC`,
  )
    .bind(orgId)
    .all();

  const tasks = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    let due = "";
    if (r.due_at) {
      const d = new Date(r.due_at as number);
      const today = startOfDay(now());
      if (r.due_at <= endOfDay(today)) due = "오늘";
      else if (r.due_at <= endOfDay(today + 86400000)) due = "내일";
      else due = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    if (r.status === "done") due = "완료";
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee_name ?? "미배정",
      dueAt: r.due_at,
      due,
    };
  });

  return c.json({ tasks });
});

app.post("/organizations/:orgId/tasks", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "tasks:write");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "tasks");
  if (feature instanceof Response) return feature;

  const body = await c.req.json<{
    title: string;
    description?: string;
    status?: string;
    dueAt?: number;
    assigneeId?: string;
  }>();

  if (!body.title?.trim()) return c.json({ error: "title required" }, 400);

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO tasks (id, organization_id, creator_id, assignee_id, title, description, status, due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      user.id,
      body.assigneeId ?? user.id,
      body.title.trim(),
      body.description ?? null,
      body.status ?? "todo",
      body.dueAt ?? null,
      ts,
      ts,
    )
    .run();

  return c.json({ id }, 201);
});

app.patch("/tasks/:taskId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare("SELECT organization_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ status?: string; title?: string }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.status) {
    updates.push("status = ?");
    values.push(body.status);
  }
  if (body.title) {
    updates.push("title = ?");
    values.push(body.title);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);

  updates.push("updated_at = ?");
  values.push(now(), taskId);

  await c.env.DB.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

// ── Notifications ──

app.get("/notifications", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(user.id)
    .all();

  const notifications = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const created = r.created_at as number;
    const diff = now() - created;
    let time = "방금";
    if (diff > 3600000) time = `${Math.floor(diff / 3600000)}시간 전`;
    else if (diff > 60000) time = `${Math.floor(diff / 60000)}분 전`;

    return {
      id: r.id,
      title: r.title,
      body: r.body,
      link: r.link,
      unread: !r.read_at,
      time,
    };
  });

  return c.json({ notifications });
});

app.patch("/notifications/:id/read", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  await c.env.DB.prepare(
    "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?",
  )
    .bind(now(), c.req.param("id"), user.id)
    .run();
  return c.json({ ok: true });
});

export const onRequest = handle(app);
