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
import { getUserBusyBlocks } from "../utils/freeBusy";
import { enhanceWithAi, findFreeSlots } from "../utils/eventSuggestions";

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

app.get("/organizations/:orgId/teams", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (member instanceof Response) return member;

  const isAdmin = member.role === "owner" || member.role === "admin";
  const { results } = isAdmin
    ? await c.env.DB.prepare(
        `SELECT id, name, color FROM teams WHERE organization_id = ? ORDER BY name`,
      )
        .bind(orgId)
        .all()
    : await c.env.DB.prepare(
        `SELECT t.id, t.name, t.color
         FROM teams t
         INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
         WHERE t.organization_id = ?
         ORDER BY t.name`,
      )
        .bind(user.id, orgId)
        .all();

  return c.json({ teams: results ?? [] });
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
       AND (
         e.visibility = 'org'
         OR e.creator_id = ?
         OR EXISTS (
           SELECT 1 FROM event_attendees ea
           WHERE ea.event_id = e.id AND ea.user_id = ?
         )
         OR (
           e.visibility = 'team' AND e.team_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM team_members tm
             WHERE tm.team_id = e.team_id AND tm.user_id = ?
           )
         )
       )
     ORDER BY e.start_at ASC`,
  )
    .bind(orgId, to, from, user.id, user.id, user.id)
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
      recurrenceRule: r.recurrence_rule,
      location: r.location ?? null,
      teamId: r.team_id ?? null,
      color: r.color ?? "#4A9FE8",
      teamName: r.team_name ?? "조직",
      time: formatEventTime(r.start_at as number, r.end_at as number, Boolean(r.all_day)),
    };
  });

  return c.json({ events });
});

app.get("/organizations/:orgId/event-participants", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ? AND m.status = 'active'
     ORDER BY u.name`,
  )
    .bind(orgId)
    .all();

  return c.json({ participants: results ?? [] });
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
    location?: string;
    startAt: number;
    endAt: number;
    allDay?: boolean;
    teamId?: string;
    color?: string;
    visibility?: "private" | "team" | "org";
    attendeeUserIds?: string[];
    reminderMinutes?: number[];
    recurrenceRule?: string | null;
  }>();

  if (!body.title?.trim() || !body.startAt || !body.endAt) {
    return c.json({ error: "title, startAt, endAt required" }, 400);
  }

  const id = newId();
  const ts = now();
  const visibility = body.visibility ?? (body.teamId ? "team" : "org");
  const attendeeUserIds = Array.from(new Set((body.attendeeUserIds ?? []).filter(Boolean)));
  const reminderMinutes = Array.from(
    new Set((body.reminderMinutes ?? [10]).filter((m) => Number.isFinite(m) && m > 0 && m <= 10080)),
  );

  await c.env.DB.prepare(
    `INSERT INTO events (
      id, organization_id, team_id, creator_id, title, description, location,
      start_at, end_at, all_day, visibility, recurrence_rule, color, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      body.teamId ?? null,
      user.id,
      body.title.trim(),
      body.description ?? null,
      body.location?.trim() || null,
      body.startAt,
      body.endAt,
      body.allDay ? 1 : 0,
      visibility,
      body.recurrenceRule ?? null,
      body.color ?? "#4A9FE8",
      ts,
      ts,
    )
    .run();

  const memberRows = await c.env.DB
    .prepare("SELECT user_id FROM memberships WHERE organization_id = ? AND status = 'active'")
    .bind(orgId)
    .all<{ user_id: string }>();
  const activeMembers = new Set((memberRows.results ?? []).map((m) => m.user_id));

  const validAttendees = attendeeUserIds.filter((uid) => uid !== user.id && activeMembers.has(uid));
  for (const attendeeId of validAttendees) {
    await c.env.DB
      .prepare("INSERT OR IGNORE INTO event_attendees (event_id, user_id, rsvp) VALUES (?, ?, 'pending')")
      .bind(id, attendeeId)
      .run();
  }

  const reminderTargets = new Set<string>([user.id, ...validAttendees]);
  for (const targetUserId of reminderTargets) {
    for (const minutes of reminderMinutes) {
      const remindAt = body.startAt - minutes * 60 * 1000;
      if (remindAt <= ts) continue;
      await c.env.DB
        .prepare(
          `INSERT INTO event_reminders (id, event_id, organization_id, user_id, reminder_minutes, remind_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId(), id, orgId, targetUserId, minutes, remindAt, ts)
        .run();
    }
  }

  return c.json({ id }, 201);
});

app.get("/organizations/:orgId/free-busy", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const userIdsParam = c.req.query("userIds") ?? "";
  const userIds = userIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (userIds.length === 0) {
    return c.json({ error: "userIds required" }, 400);
  }

  const from = Number(c.req.query("from") ?? startOfDay(now()));
  const to = Number(c.req.query("to") ?? endOfDay(now()) + 86400000 * 7);

  const users: Record<string, { userId: string; blocks: Awaited<ReturnType<typeof getUserBusyBlocks>> }> = {};
  for (const uid of userIds.slice(0, 20)) {
    const memberCheck = await c.env.DB.prepare(
      "SELECT 1 FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
    )
      .bind(orgId, uid)
      .first();
    if (!memberCheck) continue;
    users[uid] = {
      userId: uid,
      blocks: await getUserBusyBlocks(c.env.DB, orgId, uid, user.id, from, to),
    };
  }

  return c.json({ from, to, users });
});

app.post("/organizations/:orgId/events/suggest", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const body = await c.req.json<{
    prompt?: string;
    durationMinutes?: number;
    attendeeUserIds?: string[];
    from?: number;
    to?: number;
  }>();

  const durationMinutes = Math.min(480, Math.max(15, body.durationMinutes ?? 60));
  const from = body.from ?? startOfDay(now());
  const to = body.to ?? endOfDay(now()) + 86400000 * 14;
  const attendeeIds = Array.from(new Set([user.id, ...(body.attendeeUserIds ?? [])]));

  const allBusy = [];
  for (const uid of attendeeIds) {
    const blocks = await getUserBusyBlocks(c.env.DB, orgId, uid, user.id, from, to);
    allBusy.push(...blocks);
  }

  let slots = findFreeSlots(allBusy, from, to, durationMinutes, now());
  const { slots: enhanced, aiUsed, suggestedTitle } = await enhanceWithAi(
    c.env.AI,
    body.prompt ?? "",
    slots,
  );
  slots = enhanced;

  return c.json({
    suggestions: slots.map((s) => ({
      ...s,
      suggestedTitle: s.suggestedTitle ?? suggestedTitle,
    })),
    aiUsed,
  });
});

app.get("/events/:eventId/attendees", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB
    .prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const access = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (access instanceof Response) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT ea.user_id, ea.rsvp, u.name, u.email
     FROM event_attendees ea
     JOIN users u ON u.id = ea.user_id
     WHERE ea.event_id = ?
     ORDER BY u.name`,
  )
    .bind(eventId)
    .all();

  return c.json({ attendees: results ?? [] });
});

app.patch("/events/:eventId/rsvp", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB
    .prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const access = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ rsvp?: "pending" | "accepted" | "declined" }>();
  const rsvp = body.rsvp;
  if (!rsvp || !["pending", "accepted", "declined"].includes(rsvp)) {
    return c.json({ error: "Invalid RSVP" }, 400);
  }

  await c.env.DB
    .prepare(
      `INSERT INTO event_attendees (event_id, user_id, rsvp)
       VALUES (?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET rsvp = excluded.rsvp`,
    )
    .bind(eventId, user.id, rsvp)
    .run();

  return c.json({ ok: true, rsvp });
});

app.get("/organizations/:orgId/reminders", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const access = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (access instanceof Response) return access;

  const from = Number(c.req.query("from") ?? now());
  const to = Number(c.req.query("to") ?? from + 24 * 60 * 60 * 1000);

  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.event_id, r.reminder_minutes, r.remind_at, e.title, e.start_at
     FROM event_reminders r
     JOIN events e ON e.id = r.event_id
     WHERE r.organization_id = ?
       AND r.user_id = ?
       AND r.remind_at BETWEEN ? AND ?
       AND r.delivered_at IS NULL
     ORDER BY r.remind_at ASC`,
  )
    .bind(orgId, user.id, from, to)
    .all();

  return c.json({
    reminders: (results ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id,
        eventId: row.event_id,
        title: row.title,
        startAt: row.start_at,
        remindAt: row.remind_at,
        reminderMinutes: row.reminder_minutes,
      };
    }),
  });
});

app.patch("/organizations/:orgId/reminders/:reminderId/delivered", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const reminderId = c.req.param("reminderId");
  const access = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (access instanceof Response) return access;

  const result = await c.env.DB
    .prepare(
      `UPDATE event_reminders
       SET delivered_at = ?
       WHERE id = ? AND organization_id = ? AND user_id = ?`,
    )
    .bind(now(), reminderId, orgId, user.id)
    .run();

  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "Reminder not found" }, 404);
  return c.json({ ok: true });
});

app.patch("/events/:eventId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare(
    "SELECT organization_id, creator_id, start_at FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string; start_at: number }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{
    title: string;
    description?: string;
    location?: string;
    startAt: number;
    endAt: number;
    allDay?: boolean;
    teamId?: string | null;
    color?: string;
    visibility?: "private" | "team" | "org";
    attendeeUserIds?: string[];
    reminderMinutes?: number[];
    recurrenceRule?: string | null;
  }>();

  if (!body.title?.trim() || !body.startAt || !body.endAt) {
    return c.json({ error: "title, startAt, endAt required" }, 400);
  }

  const orgId = event.organization_id;
  const ts = now();
  const visibility = body.visibility ?? (body.teamId ? "team" : "org");
  const attendeeUserIds = Array.from(new Set((body.attendeeUserIds ?? []).filter(Boolean)));
  const reminderMinutes = Array.from(
    new Set((body.reminderMinutes ?? [10]).filter((m) => Number.isFinite(m) && m > 0 && m <= 10080)),
  );

  await c.env.DB.prepare(
    `UPDATE events SET
      title = ?, description = ?, location = ?, start_at = ?, end_at = ?,
      all_day = ?, team_id = ?, color = ?, visibility = ?, recurrence_rule = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      body.title.trim(),
      body.description ?? null,
      body.location?.trim() || null,
      body.startAt,
      body.endAt,
      body.allDay ? 1 : 0,
      body.teamId ?? null,
      body.color ?? "#4A9FE8",
      visibility,
      body.recurrenceRule ?? null,
      ts,
      eventId,
    )
    .run();

  const memberRows = await c.env.DB
    .prepare("SELECT user_id FROM memberships WHERE organization_id = ? AND status = 'active'")
    .bind(orgId)
    .all<{ user_id: string }>();
  const activeMembers = new Set((memberRows.results ?? []).map((m) => m.user_id));
  const validAttendees = attendeeUserIds.filter((uid) => uid !== user.id && activeMembers.has(uid));

  await c.env.DB.prepare("DELETE FROM event_attendees WHERE event_id = ?").bind(eventId).run();
  for (const attendeeId of validAttendees) {
    await c.env.DB
      .prepare("INSERT OR IGNORE INTO event_attendees (event_id, user_id, rsvp) VALUES (?, ?, 'pending')")
      .bind(eventId, attendeeId)
      .run();
  }

  await c.env.DB
    .prepare("DELETE FROM event_reminders WHERE event_id = ? AND delivered_at IS NULL")
    .bind(eventId)
    .run();

  const reminderTargets = new Set<string>([event.creator_id, ...validAttendees]);
  for (const targetUserId of reminderTargets) {
    for (const minutes of reminderMinutes) {
      const remindAt = body.startAt - minutes * 60 * 1000;
      if (remindAt <= ts) continue;
      await c.env.DB
        .prepare(
          `INSERT INTO event_reminders (id, event_id, organization_id, user_id, reminder_minutes, remind_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId(), eventId, orgId, targetUserId, minutes, remindAt, ts)
        .run();
    }
  }

  return c.json({ ok: true });
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

app.get("/notification-preferences", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const pref = await c.env.DB
    .prepare(
      `SELECT in_app_enabled, push_enabled, email_enabled
       FROM notification_preferences
       WHERE user_id = ?`,
    )
    .bind(user.id)
    .first<{ in_app_enabled: number; push_enabled: number; email_enabled: number }>();

  return c.json({
    preferences: {
      inAppEnabled: pref ? Boolean(pref.in_app_enabled) : true,
      pushEnabled: pref ? Boolean(pref.push_enabled) : false,
      emailEnabled: pref ? Boolean(pref.email_enabled) : false,
    },
  });
});

app.patch("/notification-preferences", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const body = await c.req.json<{
    inAppEnabled?: boolean;
    pushEnabled?: boolean;
    emailEnabled?: boolean;
  }>();
  const pref = {
    inAppEnabled: body.inAppEnabled ?? true,
    pushEnabled: body.pushEnabled ?? false,
    emailEnabled: body.emailEnabled ?? false,
  };

  await c.env.DB
    .prepare(
      `INSERT INTO notification_preferences (user_id, in_app_enabled, push_enabled, email_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         in_app_enabled = excluded.in_app_enabled,
         push_enabled = excluded.push_enabled,
         email_enabled = excluded.email_enabled,
         updated_at = excluded.updated_at`,
    )
    .bind(
      user.id,
      pref.inAppEnabled ? 1 : 0,
      pref.pushEnabled ? 1 : 0,
      pref.emailEnabled ? 1 : 0,
      now(),
    )
    .run();

  return c.json({ ok: true, preferences: pref });
});

export const onRequest = handle(app);
