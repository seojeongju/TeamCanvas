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
    `SELECT id, name, slug, timezone, logo_r2_key, settings_json, status,
            deactivated_at, delete_scheduled_at
     FROM organizations WHERE id = ?`,
  )
    .bind(orgId)
    .first<{
      id: string;
      name: string;
      slug: string;
      timezone: string;
      logo_r2_key: string | null;
      settings_json: string | null;
      status: string;
      deactivated_at: number | null;
      delete_scheduled_at: number | null;
    }>();

  if (!org) return c.json({ error: "Not found" }, 404);
  const stats = await getOrgStats(c.env.DB, orgId);
  const { parseOrgSettings } = await import("../utils/orgSettings");
  return c.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      role: member.role,
      status: org.status,
      deactivatedAt: org.deactivated_at,
      deleteScheduledAt: org.delete_scheduled_at,
      hasLogo: Boolean(org.logo_r2_key),
      settings: parseOrgSettings(org.settings_json),
    },
    stats,
  });
});

app.get("/organizations/:orgId/logo", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (member instanceof Response) return member;

  const org = await c.env.DB.prepare("SELECT logo_r2_key FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ logo_r2_key: string | null }>();
  if (!org?.logo_r2_key) return c.json({ error: "Not found" }, 404);

  const obj = await c.env.FILES.get(org.logo_r2_key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "image/png");
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
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

  const orgRow = await c.env.DB.prepare("SELECT settings_json FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ settings_json: string | null }>();
  const { parseOrgSettings } = await import("../utils/orgSettings");
  const { teamVisibilitySql } = await import("../utils/orgGovernance");
  const calendarPolicy = parseOrgSettings(orgRow?.settings_json).calendarPolicy;
  const teamSql = teamVisibilitySql(calendarPolicy, member.role);
  const teamBindNeeded = calendarPolicy !== "all_teams" || member.role === "guest";

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
         OR ${teamSql}
       )
     ORDER BY e.start_at ASC`,
  )
    .bind(
      orgId,
      to,
      from,
      user.id,
      user.id,
      ...(teamBindNeeded ? [user.id] : []),
    )
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
      sourceType: "event" as const,
    };
  });

  const tasksFeature = await requireOrgFeature(c, orgId, "tasks");
  if (!(tasksFeature instanceof Response)) {
    const { results: taskRows } = await c.env.DB.prepare(
      `SELECT t.id, t.title, t.due_at, t.team_id, tm.name as team_name
       FROM tasks t
       LEFT JOIN teams tm ON tm.id = t.team_id
       WHERE t.organization_id = ?
         AND t.due_at IS NOT NULL
         AND t.status != 'done'
         AND t.due_at >= ? AND t.due_at <= ?`,
    )
      .bind(orgId, from, to)
      .all();

    for (const row of taskRows ?? []) {
      const r = row as Record<string, unknown>;
      const dueAt = r.due_at as number;
      const dayStart = startOfDay(dueAt);
      const dayEnd = endOfDay(dueAt);
      events.push({
        id: `task-due:${r.id}`,
        title: `📋 ${r.title}`,
        description: "업무 마감",
        startAt: dayStart,
        endAt: dayEnd,
        allDay: true,
        visibility: "org",
        recurrenceRule: null,
        location: null,
        teamId: r.team_id ?? null,
        color: "#F97316",
        teamName: (r.team_name as string) ?? "업무",
        time: formatEventTime(dayStart, dayEnd, true),
        sourceType: "task" as const,
        taskId: r.id,
      });
    }

    events.sort((a, b) => (a.startAt as number) - (b.startAt as number));
  }

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

  const assignee = c.req.query("assignee");
  const teamId = c.req.query("teamId");
  const status = c.req.query("status");
  const overdue = c.req.query("overdue");

  let sql = `SELECT t.*, u.name as assignee_name, tm.name as team_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.team_id
     WHERE t.organization_id = ?`;
  const binds: unknown[] = [orgId];

  if (assignee === "me") {
    sql += " AND t.assignee_id = ?";
    binds.push(user.id);
  }
  if (teamId) {
    sql += " AND t.team_id = ?";
    binds.push(teamId);
  }
  if (status && ["todo", "doing", "done"].includes(status)) {
    sql += " AND t.status = ?";
    binds.push(status);
  }
  if (overdue === "true") {
    sql += " AND t.due_at IS NOT NULL AND t.due_at < ? AND t.status != 'done'";
    binds.push(now());
  }

  sql += " ORDER BY t.sort_order, t.created_at DESC";

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();

  const ts = now();
  const today = startOfDay(ts);

  const tasks = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const dueAt = r.due_at as number | null;
    const taskStatus = r.status as string;
    let due = "";
    let isOverdue = false;

    if (taskStatus === "done") {
      due = "완료";
    } else if (dueAt) {
      isOverdue = dueAt < ts;
      const d = new Date(dueAt);
      if (isOverdue) due = "지연";
      else if (dueAt <= endOfDay(today)) due = "오늘";
      else if (dueAt <= endOfDay(today + 86400000)) due = "내일";
      else due = `${d.getMonth() + 1}/${d.getDate()}`;
    }

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: taskStatus,
      priority: r.priority ?? "medium",
      assigneeId: r.assignee_id,
      assignee: r.assignee_name ?? "미배정",
      teamId: r.team_id,
      teamName: r.team_name ?? null,
      creatorId: r.creator_id,
      dueAt,
      due,
      isOverdue,
      sortOrder: r.sort_order ?? 0,
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
    priority?: string;
    teamId?: string | null;
    eventId?: string | null;
  }>();

  if (!body.title?.trim()) return c.json({ error: "title required" }, 400);

  const priority = ["low", "medium", "high"].includes(body.priority ?? "")
    ? body.priority
    : "medium";

  const id = newId();
  const ts = now();
  const assigneeId = body.assigneeId ?? user.id;

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, organization_id, team_id, creator_id, assignee_id, title, description, status, priority, due_at, event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      orgId,
      body.teamId ?? null,
      user.id,
      assigneeId,
      body.title.trim(),
      body.description ?? null,
      body.status ?? "todo",
      priority,
      body.dueAt ?? null,
      body.eventId ?? null,
      ts,
      ts,
    )
    .run();

  const { notifyTaskAssigned, notifyTaskDueSoon } = await import("../utils/notifications");
  await notifyTaskAssigned(c.env.DB, {
    assigneeId,
    actorId: user.id,
    organizationId: orgId,
    taskId: id,
    taskTitle: body.title.trim(),
  });
  if (body.dueAt && body.dueAt <= now() + 86400000) {
    await notifyTaskDueSoon(c.env.DB, {
      assigneeId,
      organizationId: orgId,
      taskId: id,
      taskTitle: body.title.trim(),
      dueAt: body.dueAt,
    });
  }

  return c.json({ id }, 201);
});

app.patch("/tasks/:taskId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const existing = await c.env.DB.prepare(
    "SELECT organization_id, assignee_id, title, due_at FROM tasks WHERE id = ?",
  )
    .bind(taskId)
    .first<{
      organization_id: string;
      assignee_id: string | null;
      title: string;
      due_at: number | null;
    }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, existing.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{
    status?: string;
    title?: string;
    description?: string | null;
    dueAt?: number | null;
    assigneeId?: string | null;
    priority?: string;
    sortOrder?: number;
    teamId?: string | null;
  }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.status !== undefined) {
    if (!["todo", "doing", "done"].includes(body.status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    updates.push("status = ?");
    values.push(body.status);
  }
  if (body.title !== undefined) {
    if (!body.title.trim()) return c.json({ error: "title required" }, 400);
    updates.push("title = ?");
    values.push(body.title.trim());
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.dueAt !== undefined) {
    updates.push("due_at = ?");
    values.push(body.dueAt);
  }
  if (body.assigneeId !== undefined) {
    updates.push("assignee_id = ?");
    values.push(body.assigneeId);
  }
  if (body.priority !== undefined) {
    if (!["low", "medium", "high"].includes(body.priority)) {
      return c.json({ error: "Invalid priority" }, 400);
    }
    updates.push("priority = ?");
    values.push(body.priority);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    values.push(body.sortOrder);
  }
  if (body.teamId !== undefined) {
    updates.push("team_id = ?");
    values.push(body.teamId);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);

  updates.push("updated_at = ?");
  values.push(now(), taskId);

  await c.env.DB.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const { notifyTaskAssigned, notifyTaskDueSoon } = await import("../utils/notifications");
  const nextAssignee =
    body.assigneeId !== undefined ? body.assigneeId : existing.assignee_id;
  const nextTitle = body.title !== undefined ? body.title.trim() : existing.title;
  const nextDue = body.dueAt !== undefined ? body.dueAt : existing.due_at;

  if (
    body.assigneeId !== undefined &&
    body.assigneeId &&
    body.assigneeId !== existing.assignee_id
  ) {
    await notifyTaskAssigned(c.env.DB, {
      assigneeId: body.assigneeId,
      actorId: user.id,
      organizationId: existing.organization_id,
      taskId,
      taskTitle: nextTitle,
    });
  }

  if (
    body.dueAt !== undefined &&
    body.dueAt &&
    body.dueAt <= now() + 86400000 &&
    body.dueAt !== existing.due_at
  ) {
    await notifyTaskDueSoon(c.env.DB, {
      assigneeId: nextAssignee ?? user.id,
      organizationId: existing.organization_id,
      taskId,
      taskTitle: nextTitle,
      dueAt: body.dueAt,
    });
  }

  return c.json({ ok: true });
});

app.get("/tasks/:taskId/comments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare("SELECT organization_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.task_id, c.user_id, c.body, c.created_at, u.name as user_name
     FROM task_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC`,
  )
    .bind(taskId)
    .all();

  const comments = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const createdAt = r.created_at as number;
    return {
      id: r.id,
      taskId: r.task_id,
      userId: r.user_id,
      userName: r.user_name,
      body: r.body,
      createdAt,
      time: new Date(createdAt).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  return c.json({ comments });
});

app.post("/tasks/:taskId/comments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare(
    "SELECT organization_id, assignee_id, creator_id, title FROM tasks WHERE id = ?",
  )
    .bind(taskId)
    .first<{
      organization_id: string;
      assignee_id: string | null;
      creator_id: string;
      title: string;
    }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ body?: string }>();
  if (!body.body?.trim()) return c.json({ error: "body required" }, 400);

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, taskId, user.id, body.body.trim(), ts)
    .run();

  const { notifyTaskComment } = await import("../utils/notifications");
  const preview = body.body.trim().slice(0, 80);
  const recipients = new Set<string>();
  if (task.assignee_id) recipients.add(task.assignee_id);
  if (task.creator_id) recipients.add(task.creator_id);
  for (const recipientId of recipients) {
    await notifyTaskComment(c.env.DB, {
      recipientId,
      actorId: user.id,
      organizationId: task.organization_id,
      taskId,
      taskTitle: task.title,
      preview,
    });
  }

  return c.json({ id }, 201);
});

app.delete("/tasks/:taskId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare("SELECT organization_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:delete");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId).run();

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
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      unread: !r.read_at,
      time,
    };
  });

  return c.json({ notifications });
});

app.patch("/notifications/read-all", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  await c.env.DB.prepare(
    "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
  )
    .bind(now(), user.id)
    .run();
  return c.json({ ok: true });
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
