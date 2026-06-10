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
  fromDateLocal,
  toDateLocal,
  formatEventTime,
  hashToken,
  appUrl,
} from "../utils/helpers";
import { signOAuthState, verifyOAuthState } from "../utils/jwt";
import { frontendUrl } from "../utils/email";
import { getUserBusyBlocks } from "../utils/freeBusy";
import { enhanceWithAi, findFreeSlots } from "../utils/eventSuggestions";
import {
  parseExcludedDatesJson,
  validateExcludedDates,
} from "../utils/eventExcludedDates";

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
     WHERE e.organization_id = ?
       AND (
         (e.start_at < ? AND e.end_at > ?)
         OR (e.recurrence_rule IS NOT NULL AND e.recurrence_rule != '' AND e.start_at < ?)
       )
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
      to,
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
      excludedDates: parseExcludedDatesJson(r.excluded_dates_json as string | null),
      location: r.location ?? null,
      teamId: r.team_id ?? null,
      color: r.color ?? "#4A9FE8",
      teamName: r.team_name ?? "조직",
      time: formatEventTime(r.start_at as number, r.end_at as number, Boolean(r.all_day)),
      sourceType: "event" as const,
      creatorId: r.creator_id,
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
      const dueDateKey = toDateLocal(dueAt);
      const dayStart = fromDateLocal(dueDateKey);
      const dayEndExclusive = dayStart + 86400000;
      events.push({
        id: `task-due:${r.id}`,
        title: `📋 ${r.title}`,
        description: "프로젝트 마감",
        startAt: dayStart,
        endAt: dayEndExclusive,
        allDay: true,
        visibility: "org",
        recurrenceRule: null,
        location: null,
        teamId: r.team_id ?? null,
        color: "#F97316",
        teamName: (r.team_name as string) ?? "프로젝트",
        time: formatEventTime(dayStart, dayEndExclusive, true),
        sourceType: "task" as const,
        taskId: r.id,
      });
    }

    events.sort((a, b) => (a.startAt as number) - (b.startAt as number));
  }

  // Google 개인 일정: 요청한 사용자 본인만 조회·병합 (팀원 API 응답에 포함되지 않음)
  const googleConn = await c.env.DB.prepare(
    "SELECT 1 FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?",
  )
    .bind(user.id, orgId)
    .first();
  if (googleConn) {
    const { fetchGoogleCalendarEventsForRange } = await import("../utils/googleCalendar");
    const personalGoogleEvents = await fetchGoogleCalendarEventsForRange(
      c.env.DB,
      user.id,
      orgId,
      from,
      to,
    );
    events.push(...personalGoogleEvents);
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
    excludedDates?: string[];
  }>();

  if (!body.title?.trim() || !body.startAt || !body.endAt) {
    return c.json({ error: "title, startAt, endAt required" }, 400);
  }

  const excludedResult = validateExcludedDates(body.excludedDates, body.startAt, body.endAt);
  if (!excludedResult.ok) return c.json({ error: excludedResult.error }, 400);

  const id = newId();
  const ts = now();
  const visibility = body.visibility ?? (body.teamId ? "team" : "org");
  const attendeeUserIds = Array.from(new Set((body.attendeeUserIds ?? []).filter(Boolean)));
  const rawReminderMinutes = body.reminderMinutes ?? [10];
  const reminderMinutes = Array.from(
    new Set(rawReminderMinutes.filter((m) => Number.isFinite(m) && m > 0 && m <= 10080)),
  );

  await c.env.DB.prepare(
    `INSERT INTO events (
      id, organization_id, team_id, creator_id, title, description, location,
      start_at, end_at, all_day, visibility, recurrence_rule, excluded_dates_json, color, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      excludedResult.json,
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

  const { notifyEventAttendee } = await import("../utils/notifications");
  for (const attendeeId of validAttendees) {
    await notifyEventAttendee(c.env.DB, c.env, {
      attendeeId,
      actorId: user.id,
      actorName: user.name,
      organizationId: orgId,
      eventId: id,
      eventTitle: body.title.trim(),
      startAt: body.startAt,
    });
  }

  const reminderTargets = Array.from(new Set<string>([user.id, ...validAttendees]));
  if (reminderMinutes.length > 0 && reminderTargets.length > 0) {
    const { insertEventReminders } = await import("../utils/reminders");
    await insertEventReminders(c.env.DB, {
      eventId: id,
      organizationId: orgId,
      startAt: body.startAt,
      recurrenceRule: body.recurrenceRule,
      excludedDates: parseExcludedDatesJson(excludedResult.json),
      reminderMinutes,
      targetUserIds: reminderTargets,
      createdAt: ts,
    });
  }

  try {
    const { pushEventToGoogleCalendar } = await import("../utils/googleCalendar");
    await pushEventToGoogleCalendar(c.env.DB, c.env, user.id, orgId, id);
  } catch (e) {
    console.error("google calendar export failed on create", id, e);
  }

  try {
    const { dispatchOrgWebhooks } = await import("../utils/webhooks");
    const when = formatEventTime(body.startAt, body.endAt, Boolean(body.allDay));
    await dispatchOrgWebhooks(
      c.env.DB,
      orgId,
      "event.created",
      {
        title: `새 일정: ${body.title.trim()}`,
        body: when,
        link: `/calendar?event=${id}`,
        actorName: user.name,
      },
      c.req.raw.url,
      c.env,
    );
  } catch {
    /* webhook optional */
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

app.get("/events/:eventId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const row = await c.env.DB.prepare(
    `SELECT e.*, t.name as team_name
     FROM events e
     LEFT JOIN teams t ON t.id = e.team_id
     WHERE e.id = ?`,
  )
    .bind(eventId)
    .first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Not found" }, 404);

  const orgId = row.organization_id as string;
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const { parseOrgSettings } = await import("../utils/orgSettings");
  const { teamVisibilitySql } = await import("../utils/orgGovernance");
  const orgRow = await c.env.DB.prepare("SELECT settings_json FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ settings_json: string | null }>();
  const calendarPolicy = parseOrgSettings(orgRow?.settings_json).calendarPolicy;
  const teamSql = teamVisibilitySql(calendarPolicy, member.role);
  const teamBindNeeded = calendarPolicy !== "all_teams" || member.role === "guest";

  const visible = await c.env.DB.prepare(
    `SELECT 1 FROM events e
     WHERE e.id = ?
       AND (
         e.visibility = 'org'
         OR e.creator_id = ?
         OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = ?)
         OR ${teamSql}
       )`,
  )
    .bind(eventId, user.id, user.id, ...(teamBindNeeded ? [user.id] : []))
    .first();
  if (!visible) return c.json({ error: "Not found" }, 404);

  const event = {
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: Boolean(row.all_day),
    visibility: row.visibility,
    recurrenceRule: row.recurrence_rule,
    excludedDates: parseExcludedDatesJson(row.excluded_dates_json as string | null),
    location: row.location ?? null,
    teamId: row.team_id ?? null,
    color: row.color ?? "#4A9FE8",
    teamName: row.team_name ?? "조직",
    time: formatEventTime(row.start_at as number, row.end_at as number, Boolean(row.all_day)),
    sourceType: "event" as const,
    creatorId: row.creator_id,
  };

  return c.json({ event });
});

app.get("/events/:eventId/linked-tasks", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (member instanceof Response) return member;

  const { fetchLinkedTasks } = await import("../utils/eventTaskLink");
  const tasks = await fetchLinkedTasks(c.env.DB, eventId, event.organization_id);
  return c.json({ tasks });
});

app.get("/events/:eventId/comments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.event_id, c.user_id, c.body, c.created_at, u.name as user_name
     FROM event_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.event_id = ?
     ORDER BY c.created_at ASC`,
  )
    .bind(eventId)
    .all();

  const comments = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const createdAt = r.created_at as number;
    return {
      id: r.id,
      eventId: r.event_id,
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

app.post("/events/:eventId/comments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare(
    "SELECT organization_id, creator_id, title, visibility, team_id FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{
      organization_id: string;
      creator_id: string;
      title: string;
      visibility: string;
      team_id: string | null;
    }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ body?: string }>();
  if (!body.body?.trim()) return c.json({ error: "body required" }, 400);

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO event_comments (id, event_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, eventId, user.id, body.body.trim(), ts)
    .run();

  const { notifyEventComment, notifyEventMention } = await import("../utils/notifications");
  const { parseMentionedUserIds } = await import("../utils/mentions");
  const { resolveEventCommentRecipients } = await import("../utils/eventCommentRecipients");
  const preview = body.body.trim().slice(0, 80);
  const actorName = user.name?.trim() || "팀원";

  const { results: memberRows } = await c.env.DB.prepare(
    `SELECT u.id, u.name FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ? AND m.status = 'active'`,
  )
    .bind(event.organization_id)
    .all();

  const members = (memberRows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { id: row.id as string, name: row.name as string };
  });

  const mentionedIds = parseMentionedUserIds(body.body.trim(), members);
  for (const mentionedId of mentionedIds) {
    await notifyEventMention(c.env.DB, c.env, {
      mentionedUserId: mentionedId,
      actorId: user.id,
      actorName,
      organizationId: event.organization_id,
      eventId,
      eventTitle: event.title,
      preview,
    });
  }

  const recipients = await resolveEventCommentRecipients(c.env.DB, eventId, event);

  for (const recipientId of recipients) {
    if (mentionedIds.includes(recipientId)) continue;
    await notifyEventComment(c.env.DB, c.env, {
      recipientId,
      actorId: user.id,
      actorName,
      organizationId: event.organization_id,
      eventId,
      eventTitle: event.title,
      preview,
    });
  }

  return c.json({ id }, 201);
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

  const ts = now();
  const windowMs = 24 * 60 * 60 * 1000;
  const from = Number(c.req.query("from") ?? ts - windowMs);
  const to = Number(c.req.query("to") ?? ts + windowMs);

  try {
    const { processDueReminders } = await import("../utils/reminders");
    await processDueReminders(c.env.DB, c.env);
  } catch {
    // notified_at 컬럼 미적용 등 — 목록 조회는 계속 진행
  }

  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.event_id, r.reminder_minutes, r.remind_at, e.title, e.start_at, e.end_at
     FROM event_reminders r
     JOIN events e ON e.id = r.event_id
     WHERE r.organization_id = ?
       AND r.user_id = ?
       AND r.delivered_at IS NULL
       AND e.end_at > ?
       AND r.remind_at >= ?
       AND r.remind_at <= ?
     ORDER BY r.remind_at ASC
     LIMIT 20`,
  )
    .bind(orgId, user.id, ts, from, to)
    .all();

  return c.json({
    reminders: (results ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id,
        eventId: row.event_id,
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
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
    "SELECT organization_id, creator_id, start_at, excluded_dates_json FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string; start_at: number; excluded_dates_json: string | null }>();
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
    excludedDates?: string[];
  }>();

  if (!body.title?.trim() || !body.startAt || !body.endAt) {
    return c.json({ error: "title, startAt, endAt required" }, 400);
  }

  let excludedJson = event.excluded_dates_json;
  if (body.excludedDates !== undefined) {
    const excludedResult = validateExcludedDates(body.excludedDates, body.startAt, body.endAt);
    if (!excludedResult.ok) return c.json({ error: excludedResult.error }, 400);
    excludedJson = excludedResult.json;
  } else {
    const revalidated = validateExcludedDates(
      parseExcludedDatesJson(event.excluded_dates_json),
      body.startAt,
      body.endAt,
    );
    if (!revalidated.ok) return c.json({ error: revalidated.error }, 400);
    excludedJson = revalidated.json;
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
      all_day = ?, team_id = ?, color = ?, visibility = ?, recurrence_rule = ?,
      excluded_dates_json = ?, updated_at = ?
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
      excludedJson,
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

  const prevAttendeeRows = await c.env.DB
    .prepare("SELECT user_id FROM event_attendees WHERE event_id = ?")
    .bind(eventId)
    .all<{ user_id: string }>();
  const prevAttendees = new Set((prevAttendeeRows.results ?? []).map((r) => r.user_id));

  await c.env.DB.prepare("DELETE FROM event_attendees WHERE event_id = ?").bind(eventId).run();
  for (const attendeeId of validAttendees) {
    await c.env.DB
      .prepare("INSERT OR IGNORE INTO event_attendees (event_id, user_id, rsvp) VALUES (?, ?, 'pending')")
      .bind(eventId, attendeeId)
      .run();
  }

  const { notifyEventAttendee } = await import("../utils/notifications");
  for (const attendeeId of validAttendees) {
    if (prevAttendees.has(attendeeId)) continue;
    await notifyEventAttendee(c.env.DB, c.env, {
      attendeeId,
      actorId: user.id,
      actorName: user.name,
      organizationId: orgId,
      eventId,
      eventTitle: body.title.trim(),
      startAt: body.startAt,
    });
  }

  await c.env.DB
    .prepare("DELETE FROM event_reminders WHERE event_id = ? AND delivered_at IS NULL")
    .bind(eventId)
    .run();

  const reminderTargets = Array.from(new Set<string>([event.creator_id, ...validAttendees]));
  if (reminderMinutes.length > 0 && reminderTargets.length > 0) {
    const { insertEventReminders } = await import("../utils/reminders");
    await insertEventReminders(c.env.DB, {
      eventId,
      organizationId: orgId,
      startAt: body.startAt,
      recurrenceRule: body.recurrenceRule ?? null,
      excludedDates: parseExcludedDatesJson(excludedJson),
      reminderMinutes,
      targetUserIds: reminderTargets,
      createdAt: ts,
    });
  }

  try {
    const { pushEventToGoogleCalendar } = await import("../utils/googleCalendar");
    await pushEventToGoogleCalendar(c.env.DB, c.env, event.creator_id, orgId, eventId);
  } catch (e) {
    console.error("google calendar export failed on update", eventId, e);
  }

  return c.json({ ok: true });
});

app.delete("/events/:eventId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  if (eventId.startsWith("google:") || eventId.startsWith("task-due:")) {
    return c.json({ error: "이 일정은 앱에서 삭제할 수 없습니다." }, 400);
  }

  const event = await c.env.DB.prepare(
    "SELECT organization_id, creator_id FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const canDeleteAny = await requireOrgPermission(c, user.id, event.organization_id, "events:delete");
  if (canDeleteAny instanceof Response) {
    if (event.creator_id !== user.id) return canDeleteAny;
    const canWrite = await requireOrgPermission(c, user.id, event.organization_id, "events:write");
    if (canWrite instanceof Response) return canWrite;
  }

  try {
    try {
      const { removeEventFromGoogleCalendar } = await import("../utils/googleCalendar");
      await removeEventFromGoogleCalendar(
        c.env.DB,
        c.env,
        event.creator_id,
        event.organization_id,
        eventId,
      );
    } catch (e) {
      console.error("google calendar delete failed", eventId, e);
    }

    const { results: fileRows } = await c.env.DB.prepare(
      "SELECT id, r2_key FROM files WHERE entity_type = 'event' AND entity_id = ?",
    )
      .bind(eventId)
      .all();
    for (const row of fileRows ?? []) {
      const r = row as { id: string; r2_key: string };
      await c.env.FILES.delete(r.r2_key).catch(() => undefined);
      await c.env.DB.prepare("DELETE FROM files WHERE id = ?").bind(r.id).run();
    }

    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE tasks SET event_id = NULL WHERE event_id = ?").bind(eventId),
      c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(eventId),
    ]);
    return c.json({ ok: true });
  } catch (e) {
    console.error("delete event failed", eventId, e);
    return c.json(
      { error: e instanceof Error ? e.message : "일정 삭제에 실패했습니다." },
      500,
    );
  }
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

  let sql = `SELECT t.*, u.name as assignee_name, tm.name as team_name,
       e.id as le_id, e.title as le_title, e.start_at as le_start_at, e.end_at as le_end_at, e.all_day as le_all_day
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN teams tm ON tm.id = t.team_id
     LEFT JOIN events e ON e.id = t.event_id
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

    const linkedEvent = r.le_id
      ? {
          id: r.le_id as string,
          title: r.le_title as string,
          startAt: r.le_start_at as number,
          endAt: r.le_end_at as number,
          allDay: Boolean(r.le_all_day),
        }
      : null;

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
      eventId: r.event_id ?? null,
      linkedEvent,
      dueAt,
      due,
      isOverdue,
      sortOrder: r.sort_order ?? 0,
      updatedAt: r.updated_at as number,
    };
  });

  const { fetchLabelsForTasks } = await import("../utils/taskExtras");
  const labelMap = await fetchLabelsForTasks(
    c.env.DB,
    tasks.map((t) => t.id as string),
  );
  const tasksWithLabels = tasks.map((t) => ({
    ...t,
    labels: labelMap[t.id as string] ?? [],
  }));

  return c.json({ tasks: tasksWithLabels });
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
    labelIds?: string[];
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
  await notifyTaskAssigned(c.env.DB, c.env, {
    assigneeId,
    actorId: user.id,
    organizationId: orgId,
    taskId: id,
    taskTitle: body.title.trim(),
  });
  if (body.dueAt && body.dueAt <= now() + 86400000) {
    await notifyTaskDueSoon(c.env.DB, c.env, {
      assigneeId,
      organizationId: orgId,
      taskId: id,
      taskTitle: body.title.trim(),
      dueAt: body.dueAt,
    });
  }

  const { logTaskCreated } = await import("../utils/taskActivities");
  await logTaskCreated(c.env.DB, orgId, id, user.id, body.title.trim());

  if (assigneeId && assigneeId !== user.id) {
    try {
      const { dispatchOrgWebhooks } = await import("../utils/webhooks");
      await dispatchOrgWebhooks(
        c.env.DB,
        orgId,
        "task.assigned",
        {
          title: `프로젝트 배정: ${body.title.trim()}`,
          link: `/tasks?task=${id}`,
          actorName: user.name,
        },
        c.req.raw.url,
        c.env,
      );
    } catch {
      /* optional */
    }
  }

  if (body.labelIds?.length) {
    const { syncTaskLabels } = await import("../utils/taskExtras");
    await syncTaskLabels(c.env.DB, id, body.labelIds, orgId);
  }

  return c.json({ id }, 201);
});

app.patch("/tasks/:taskId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const existing = await c.env.DB.prepare(
    `SELECT organization_id, assignee_id, title, description, due_at, status, priority, team_id
     FROM tasks WHERE id = ?`,
  )
    .bind(taskId)
    .first<{
      organization_id: string;
      assignee_id: string | null;
      title: string;
      description: string | null;
      due_at: number | null;
      status: string;
      priority: string;
      team_id: string | null;
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
    eventId?: string | null;
    labelIds?: string[];
  }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.labelIds !== undefined) {
    const { syncTaskLabels } = await import("../utils/taskExtras");
    await syncTaskLabels(c.env.DB, taskId, body.labelIds, existing.organization_id);
    const { logTaskLabelsUpdated } = await import("../utils/taskActivities");
    await logTaskLabelsUpdated(c.env.DB, existing.organization_id, taskId, user.id);
  }

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
  if (body.eventId !== undefined) {
    const { validateTaskEventLink } = await import("../utils/eventTaskLink");
    const linkCheck = await validateTaskEventLink(
      c.env.DB,
      existing.organization_id,
      body.eventId,
    );
    if (!linkCheck.ok) return c.json({ error: linkCheck.error }, 400);
    updates.push("event_id = ?");
    values.push(body.eventId);
  }
  if (!updates.length && body.labelIds === undefined) {
    return c.json({ error: "Nothing to update" }, 400);
  }
  if (!updates.length) return c.json({ ok: true });

  updates.push("updated_at = ?");
  values.push(now(), taskId);

  await c.env.DB.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const { logTaskUpdates } = await import("../utils/taskActivities");
  await logTaskUpdates(c.env.DB, existing.organization_id, taskId, user.id, existing, body);

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
    await notifyTaskAssigned(c.env.DB, c.env, {
      assigneeId: body.assigneeId,
      actorId: user.id,
      organizationId: existing.organization_id,
      taskId,
      taskTitle: nextTitle,
    });
    try {
      const { dispatchOrgWebhooks } = await import("../utils/webhooks");
      await dispatchOrgWebhooks(
        c.env.DB,
        existing.organization_id,
        "task.assigned",
        {
          title: `프로젝트 배정: ${nextTitle}`,
          link: `/tasks?task=${taskId}`,
          actorName: user.name,
        },
        c.req.raw.url,
        c.env,
      );
    } catch {
      /* optional */
    }
  }

  if (body.status === "done" && existing.status !== "done") {
    try {
      const { dispatchOrgWebhooks } = await import("../utils/webhooks");
      await dispatchOrgWebhooks(
        c.env.DB,
        existing.organization_id,
        "task.completed",
        {
          title: `프로젝트 완료: ${nextTitle}`,
          link: `/tasks?task=${taskId}`,
          actorName: user.name,
        },
        c.req.raw.url,
        c.env,
      );
    } catch {
      /* optional */
    }
  }

  if (
    body.dueAt !== undefined &&
    body.dueAt &&
    body.dueAt <= now() + 86400000 &&
    body.dueAt !== existing.due_at
  ) {
    await notifyTaskDueSoon(c.env.DB, c.env, {
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

  const trimmedBody = body.body.trim();
  const preview = trimmedBody.slice(0, 80);
  const { insertTaskActivity } = await import("../utils/taskActivities");
  await insertTaskActivity(c.env.DB, {
    taskId,
    organizationId: task.organization_id,
    actorId: user.id,
    action: "comment",
    summary: `댓글: ${trimmedBody.slice(0, 60)}${trimmedBody.length > 60 ? "…" : ""}`,
  });

  const { notifyTaskComment, notifyTaskMention } = await import("../utils/notifications");
  const { parseMentionedUserIds } = await import("../utils/mentions");

  const { results: memberRows } = await c.env.DB.prepare(
    `SELECT u.id, u.name FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ? AND m.status = 'active'`,
  )
    .bind(task.organization_id)
    .all();

  const members = (memberRows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { id: row.id as string, name: row.name as string };
  });

  const mentionedIds = parseMentionedUserIds(body.body.trim(), members);
  for (const mentionedId of mentionedIds) {
    await notifyTaskMention(c.env.DB, c.env, {
      mentionedUserId: mentionedId,
      actorId: user.id,
      organizationId: task.organization_id,
      taskId,
      taskTitle: task.title,
      preview,
    });
  }

  const recipients = new Set<string>();
  if (task.assignee_id) recipients.add(task.assignee_id);
  if (task.creator_id) recipients.add(task.creator_id);
  for (const recipientId of recipients) {
    if (mentionedIds.includes(recipientId)) continue;
    await notifyTaskComment(c.env.DB, c.env, {
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

  const task = await c.env.DB.prepare("SELECT organization_id, creator_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string; creator_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const canDeleteAny = await requireOrgPermission(c, user.id, task.organization_id, "tasks:delete");
  if (canDeleteAny instanceof Response) {
    if (task.creator_id !== user.id) return canDeleteAny;
    const canWrite = await requireOrgPermission(c, user.id, task.organization_id, "tasks:write");
    if (canWrite instanceof Response) return canWrite;
  }

  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId).run();

  return c.json({ ok: true });
});

// ── Activity feed ──

app.get("/organizations/:orgId/activity", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (member instanceof Response) return member;

  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
  const { fetchOrgActivity } = await import("../utils/orgActivity");
  const items = await fetchOrgActivity(c.env.DB, orgId, limit);
  return c.json({ items });
});

// ── Search ──

app.get("/organizations/:orgId/search", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (member instanceof Response) return member;

  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ results: [] });

  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
  const { searchOrganization } = await import("../utils/search");
  const results = await searchOrganization(c.env.DB, orgId, q, limit);
  return c.json({ results });
});

// ── Event share links (read-only public) ──

app.get("/events/:eventId/share", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare(
    "SELECT organization_id, creator_id, visibility FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string; visibility: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);
  if (event.visibility === "private" && event.creator_id !== user.id) {
    return c.json({ error: "비공개 일정은 공유할 수 없습니다." }, 403);
  }

  const access = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (access instanceof Response) return access;

  const row = await c.env.DB.prepare(
    "SELECT created_at, last_used_at, expires_at FROM event_share_tokens WHERE event_id = ?",
  )
    .bind(eventId)
    .first<{ created_at: number; last_used_at: number | null; expires_at: number | null }>();

  return c.json({
    active: !!row,
    createdAt: row?.created_at ?? null,
    lastUsedAt: row?.last_used_at ?? null,
    expiresAt: row?.expires_at ?? null,
  });
});

app.post("/events/:eventId/share", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare(
    "SELECT organization_id, creator_id, visibility FROM events WHERE id = ?",
  )
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string; visibility: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);
  if (event.visibility === "private") {
    return c.json({ error: "비공개 일정은 공유 링크를 만들 수 없습니다." }, 400);
  }

  const canWrite = await requireOrgPermission(c, user.id, event.organization_id, "events:write");
  if (canWrite instanceof Response && event.creator_id !== user.id) return canWrite;

  const body = await c.req.json<{ expiresInDays?: number }>().catch(() => ({}));
  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? now() + body.expiresInDays * 24 * 60 * 60 * 1000
      : null;

  const { createEventShareToken } = await import("../utils/eventShare");
  const token = await createEventShareToken(c.env.DB, {
    eventId,
    organizationId: event.organization_id,
    createdBy: user.id,
    expiresAt,
  });

  const base = appUrl(c.req.raw, c.env);
  const shareUrl = `${base}/share/${token}`;

  return c.json({ url: shareUrl, expiresAt, createdAt: now() }, 201);
});

app.delete("/events/:eventId/share", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare("SELECT organization_id, creator_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string; creator_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const canWrite = await requireOrgPermission(c, user.id, event.organization_id, "events:write");
  if (canWrite instanceof Response && event.creator_id !== user.id) return canWrite;

  await c.env.DB.prepare("DELETE FROM event_share_tokens WHERE event_id = ?").bind(eventId).run();
  return c.json({ ok: true });
});

app.get("/share/event/:token", async (c) => {
  const token = c.req.param("token");
  const { resolveEventShareToken, fetchSharedEvent, touchEventShareToken } = await import(
    "../utils/eventShare"
  );

  const resolved = await resolveEventShareToken(c.env.DB, token);
  if (!resolved) return c.json({ error: "공유 링크가 유효하지 않거나 만료되었습니다." }, 404);

  const event = await fetchSharedEvent(c.env.DB, resolved.eventId, resolved.organizationId);
  if (!event) return c.json({ error: "일정을 찾을 수 없습니다." }, 404);

  await touchEventShareToken(c.env.DB, resolved.tokenHash);
  return c.json({ event });
});

// ── iCal export & subscription feed ──

app.get("/organizations/:orgId/events/ical", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const from = Number(c.req.query("from") ?? startOfDay(now()));
  const to = Number(c.req.query("to") ?? endOfDay(now()) + 86400000 * 90);

  const { fetchVisibleOrgEvents, buildIcalFromEvents, buildIcalResponse } = await import(
    "../utils/icalFeed"
  );
  const { orgName, events } = await fetchVisibleOrgEvents(
    c.env.DB,
    orgId,
    user.id,
    member.role,
    from,
    to,
  );
  const ics = buildIcalFromEvents(events, orgName);
  return buildIcalResponse(ics, `teamcanvas-${orgId.slice(0, 8)}.ics`, "attachment");
});

app.get("/organizations/:orgId/ical-feed", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const row = await c.env.DB.prepare(
    "SELECT created_at, last_used_at FROM ical_feed_tokens WHERE user_id = ? AND organization_id = ?",
  )
    .bind(user.id, orgId)
    .first<{ created_at: number; last_used_at: number | null }>();

  return c.json({
    active: !!row,
    createdAt: row?.created_at ?? null,
    lastUsedAt: row?.last_used_at ?? null,
  });
});

app.post("/organizations/:orgId/ical-feed", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const feature = await requireOrgFeature(c, orgId, "calendar");
  if (feature instanceof Response) return feature;

  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await hashToken(token);
  const ts = now();
  const id = newId();

  await c.env.DB.prepare("DELETE FROM ical_feed_tokens WHERE user_id = ? AND organization_id = ?")
    .bind(user.id, orgId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO ical_feed_tokens (id, user_id, organization_id, token_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, user.id, orgId, tokenHash, ts)
    .run();

  const base = appUrl(c.req.raw, c.env);
  const feedPath = `/api/feed/ical/${token}`;
  const httpsUrl = `${base}${feedPath}`;
  const webcalUrl = `webcal://${base.replace(/^https?:\/\//, "")}${feedPath}`;

  return c.json({ url: httpsUrl, webcalUrl, createdAt: ts }, 201);
});

app.delete("/organizations/:orgId/ical-feed", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM ical_feed_tokens WHERE user_id = ? AND organization_id = ?")
    .bind(user.id, orgId)
    .run();

  return c.json({ ok: true });
});

app.get("/feed/ical/:token", async (c) => {
  const token = c.req.param("token");
  if (!token || token.length < 32) {
    return c.json({ error: "Invalid token" }, 400);
  }

  const tokenHash = await hashToken(token);
  const feed = await c.env.DB.prepare(
    `SELECT t.user_id, t.organization_id, m.role
     FROM ical_feed_tokens t
     JOIN memberships m ON m.user_id = t.user_id AND m.organization_id = t.organization_id
     WHERE t.token_hash = ? AND m.status = 'active'`,
  )
    .bind(tokenHash)
    .first<{ user_id: string; organization_id: string; role: string }>();

  if (!feed) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare("UPDATE ical_feed_tokens SET last_used_at = ? WHERE token_hash = ?")
    .bind(now(), tokenHash)
    .run();

  const from = startOfDay(now()) - 86400000 * 30;
  const to = endOfDay(now()) + 86400000 * 365;

  const { fetchVisibleOrgEvents, buildIcalFromEvents, buildIcalResponse } = await import(
    "../utils/icalFeed"
  );
  const { orgName, events } = await fetchVisibleOrgEvents(
    c.env.DB,
    feed.organization_id,
    feed.user_id,
    feed.role,
    from,
    to,
  );
  const ics = buildIcalFromEvents(events, orgName);
  return buildIcalResponse(ics, "teamcanvas.ics", "inline");
});

// ── Files ──

async function assertEntityFileAccess(
  c: { env: Env; json: (data: unknown, status?: number) => Response },
  userId: string,
  orgId: string,
  entityType: string,
  entityId: string,
  mode: "read" | "write",
): Promise<Response | null> {
  if (entityType === "task") {
    const task = await c.env.DB.prepare(
      "SELECT organization_id FROM tasks WHERE id = ? AND organization_id = ?",
    )
      .bind(entityId, orgId)
      .first();
    if (!task) return c.json({ error: "Task not found" }, 404);
    const member = await requireOrgPermission(c, userId, orgId, mode === "read" ? "tasks:read" : "tasks:write");
    return member instanceof Response ? member : null;
  }
  if (entityType === "event") {
    const event = await c.env.DB.prepare(
      "SELECT organization_id FROM events WHERE id = ? AND organization_id = ?",
    )
      .bind(entityId, orgId)
      .first();
    if (!event) return c.json({ error: "Event not found" }, 404);
    const member = await requireOrgPermission(c, userId, orgId, mode === "read" ? "events:read" : "events:write");
    return member instanceof Response ? member : null;
  }
  return c.json({ error: "Unsupported entity type" }, 400);
}

app.get("/tasks/:taskId/files", async (c) => {
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
    `SELECT id, filename, mime_type, size_bytes, created_at
     FROM files WHERE organization_id = ? AND entity_type = 'task' AND entity_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(task.organization_id, taskId)
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

app.get("/events/:eventId/files", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const eventId = c.req.param("eventId");

  const event = await c.env.DB.prepare("SELECT organization_id FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ organization_id: string }>();
  if (!event) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, event.organization_id, "events:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    `SELECT id, filename, mime_type, size_bytes, created_at
     FROM files WHERE organization_id = ? AND entity_type = 'event' AND entity_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(event.organization_id, eventId)
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

app.post("/organizations/:orgId/files", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const feature = await requireOrgFeature(c, orgId, "file_storage");
  if (feature instanceof Response) return feature;

  const form = await c.req.parseBody();
  const file = form.file;
  const entityType = String(form.entityType ?? "");
  const entityId = String(form.entityId ?? "");

  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (!entityType || !entityId) return c.json({ error: "entityType and entityId required" }, 400);
  if (entityType !== "task" && entityType !== "event") {
    return c.json({ error: "Unsupported entity type" }, 400);
  }

  const accessErr = await assertEntityFileAccess(c, user.id, orgId, entityType, entityId, "write");
  if (accessErr) return accessErr;

  const { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, attachmentExtension, attachmentKey } =
    await import("../utils/storage");

  if (!ATTACHMENT_MIME_TYPES.has(file.type)) {
    return c.json({ error: "Unsupported file type" }, 400);
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return c.json({ error: "File must be 25MB or smaller" }, 400);
  }

  const fileId = newId();
  const ext = attachmentExtension(file.name, file.type);
  const key = attachmentKey(orgId, entityType, entityId, fileId, ext);
  const bytes = await file.arrayBuffer();

  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: file.type } });

  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO files (id, organization_id, uploader_id, r2_key, filename, mime_type, size_bytes, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(fileId, orgId, user.id, key, file.name, file.type, file.size, entityType, entityId, ts)
    .run();

  return c.json({ id: fileId, filename: file.name, mimeType: file.type, sizeBytes: file.size }, 201);
});

app.get("/files/:fileId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const fileId = c.req.param("fileId");

  const row = await c.env.DB.prepare(
    "SELECT organization_id, r2_key, filename, mime_type, entity_type, entity_id FROM files WHERE id = ?",
  )
    .bind(fileId)
    .first<{
      organization_id: string;
      r2_key: string;
      filename: string;
      mime_type: string;
      entity_type: string | null;
      entity_id: string | null;
    }>();
  if (!row) return c.json({ error: "Not found" }, 404);

  let accessErr: Response | null = null;
  if (row.entity_type && row.entity_id) {
    accessErr = await assertEntityFileAccess(
      c,
      user.id,
      row.organization_id,
      row.entity_type,
      row.entity_id,
      "read",
    );
  } else {
    const member = await requireOrgPermission(c, user.id, row.organization_id, "tasks:read");
    if (member instanceof Response) accessErr = member;
  }
  if (accessErr) return accessErr;

  const obj = await c.env.FILES.get(row.r2_key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", row.mime_type);
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(row.filename)}"`);
  return new Response(obj.body, { headers });
});

app.delete("/files/:fileId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const fileId = c.req.param("fileId");

  const row = await c.env.DB.prepare(
    "SELECT organization_id, r2_key, uploader_id, entity_type, entity_id FROM files WHERE id = ?",
  )
    .bind(fileId)
    .first<{
      organization_id: string;
      r2_key: string;
      uploader_id: string;
      entity_type: string | null;
      entity_id: string | null;
    }>();
  if (!row) return c.json({ error: "Not found" }, 404);

  let accessErr: Response | null = null;
  if (row.entity_type && row.entity_id) {
    accessErr = await assertEntityFileAccess(
      c,
      user.id,
      row.organization_id,
      row.entity_type,
      row.entity_id,
      "write",
    );
  } else {
    const member = await requireOrgPermission(c, user.id, row.organization_id, "tasks:write");
    if (member instanceof Response) accessErr = member;
  }
  if (accessErr) return accessErr;

  await c.env.FILES.delete(row.r2_key);
  await c.env.DB.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();
  return c.json({ ok: true });
});

// ── Task labels ──

app.get("/organizations/:orgId/labels", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "tasks:read");
  if (member instanceof Response) return member;

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, color, created_at FROM task_labels WHERE organization_id = ? ORDER BY name",
  )
    .bind(orgId)
    .all();

  const labels = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return { id: r.id, name: r.name, color: r.color, createdAt: r.created_at };
  });
  return c.json({ labels });
});

app.post("/organizations/:orgId/labels", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const member = await requireOrgPermission(c, user.id, orgId, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ name?: string; color?: string }>();
  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);

  const id = newId();
  const ts = now();
  try {
    await c.env.DB.prepare(
      "INSERT INTO task_labels (id, organization_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, orgId, body.name.trim(), body.color ?? "#4A9FE8", ts)
      .run();
  } catch {
    return c.json({ error: "Label name already exists" }, 409);
  }
  return c.json({ id, name: body.name.trim(), color: body.color ?? "#4A9FE8" }, 201);
});

app.patch("/labels/:labelId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const labelId = c.req.param("labelId");

  const label = await c.env.DB.prepare("SELECT organization_id FROM task_labels WHERE id = ?")
    .bind(labelId)
    .first<{ organization_id: string }>();
  if (!label) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, label.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ name?: string; color?: string }>();
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.name?.trim()) {
    updates.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.color) {
    updates.push("color = ?");
    values.push(body.color);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);
  values.push(labelId);
  await c.env.DB.prepare(`UPDATE task_labels SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
  return c.json({ ok: true });
});

app.delete("/labels/:labelId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const labelId = c.req.param("labelId");

  const label = await c.env.DB.prepare("SELECT organization_id FROM task_labels WHERE id = ?")
    .bind(labelId)
    .first<{ organization_id: string }>();
  if (!label) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, label.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM task_labels WHERE id = ?").bind(labelId).run();
  return c.json({ ok: true });
});

// ── Task checklist ──

app.get("/tasks/:taskId/checklist", async (c) => {
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
    "SELECT id, task_id, title, done, sort_order, created_at FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order, created_at",
  )
    .bind(taskId)
    .all();

  const items = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      taskId: r.task_id,
      title: r.title,
      done: Boolean(r.done),
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    };
  });
  return c.json({ items });
});

app.post("/tasks/:taskId/checklist", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare("SELECT organization_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ title?: string }>();
  if (!body.title?.trim()) return c.json({ error: "title required" }, 400);

  const maxRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) as m FROM task_checklist_items WHERE task_id = ?",
  )
    .bind(taskId)
    .first<{ m: number }>();

  const id = newId();
  const ts = now();
  const sortOrder = (maxRow?.m ?? -1) + 1;
  const itemTitle = body.title.trim();
  await c.env.DB.prepare(
    "INSERT INTO task_checklist_items (id, task_id, title, done, sort_order, created_at) VALUES (?, ?, ?, 0, ?, ?)",
  )
    .bind(id, taskId, itemTitle, sortOrder, ts)
    .run();

  const { insertTaskActivity } = await import("../utils/taskActivities");
  await insertTaskActivity(c.env.DB, {
    taskId,
    organizationId: task.organization_id,
    actorId: user.id,
    action: "checklist_add",
    summary: `체크리스트 추가: ${itemTitle}`,
  });

  return c.json({ id, sortOrder }, 201);
});

app.patch("/tasks/:taskId/checklist/:itemId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");
  const itemId = c.req.param("itemId");

  const item = await c.env.DB.prepare(
    `SELECT c.id, c.title, c.done, t.organization_id FROM task_checklist_items c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.id = ? AND c.task_id = ?`,
  )
    .bind(itemId, taskId)
    .first<{ id: string; title: string; done: number; organization_id: string }>();
  if (!item) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, item.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  const body = await c.req.json<{ title?: string; done?: boolean; sortOrder?: number }>();
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title.trim());
  }
  if (body.done !== undefined) {
    updates.push("done = ?");
    values.push(body.done ? 1 : 0);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    values.push(body.sortOrder);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);
  values.push(itemId);
  await c.env.DB.prepare(`UPDATE task_checklist_items SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  if (body.done !== undefined && Boolean(body.done) !== Boolean(item.done)) {
    const { insertTaskActivity } = await import("../utils/taskActivities");
    await insertTaskActivity(c.env.DB, {
      taskId,
      organizationId: item.organization_id,
      actorId: user.id,
      action: "checklist_done",
      summary: body.done ? `체크리스트 완료: ${item.title}` : `체크리스트 미완료: ${item.title}`,
    });
  }

  return c.json({ ok: true });
});

app.delete("/tasks/:taskId/checklist/:itemId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");
  const itemId = c.req.param("itemId");

  const item = await c.env.DB.prepare(
    `SELECT c.id, c.title, t.organization_id FROM task_checklist_items c
     JOIN tasks t ON t.id = c.task_id
     WHERE c.id = ? AND c.task_id = ?`,
  )
    .bind(itemId, taskId)
    .first<{ id: string; title: string; organization_id: string }>();
  if (!item) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, item.organization_id, "tasks:write");
  if (member instanceof Response) return member;

  await c.env.DB.prepare("DELETE FROM task_checklist_items WHERE id = ?").bind(itemId).run();

  const { insertTaskActivity } = await import("../utils/taskActivities");
  await insertTaskActivity(c.env.DB, {
    taskId,
    organizationId: item.organization_id,
    actorId: user.id,
    action: "checklist_remove",
    summary: `체크리스트 삭제: ${item.title}`,
  });

  return c.json({ ok: true });
});

app.get("/tasks/:taskId/activities", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare("SELECT organization_id FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ organization_id: string }>();
  if (!task) return c.json({ error: "Not found" }, 404);

  const member = await requireOrgPermission(c, user.id, task.organization_id, "tasks:read");
  if (member instanceof Response) return member;

  const { fetchTaskActivities } = await import("../utils/taskActivities");
  const activities = await fetchTaskActivities(c.env.DB, taskId);
  return c.json({ activities });
});

// ── Google Calendar integration ──

app.get("/integrations/google-calendar/status", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.query("orgId");
  if (!orgId) return c.json({ error: "orgId required" }, 400);

  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  const row = await c.env.DB.prepare(
    "SELECT updated_at FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?",
  )
    .bind(user.id, orgId)
    .first<{ updated_at: number }>();

  return c.json({ connected: !!row, updatedAt: row?.updated_at ?? null });
});

app.get("/integrations/google-calendar/connect", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.query("orgId");
  if (!orgId) return c.json({ error: "orgId required" }, 400);

  const member = await requireOrgPermission(c, user.id, orgId, "events:read");
  if (member instanceof Response) return member;

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "Google OAuth not configured" }, 503);
  }

  const state = await signOAuthState(
    { purpose: "google_calendar", userId: user.id, orgId },
    c.env.JWT_SECRET,
  );
  const { googleCalendarAuthUrl, googleCalendarRedirectUri } = await import("../utils/googleCalendar");
  const redirectUri = googleCalendarRedirectUri(appUrl(c.req.raw, c.env));
  const url = googleCalendarAuthUrl(c.env.GOOGLE_CLIENT_ID, redirectUri, state);
  return c.redirect(url);
});

app.get("/integrations/google-calendar/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const base = frontendUrl(c.req.raw, c.env);

  if (error) {
    return c.redirect(`${base}/calendar?google=denied`);
  }
  if (!code || !state) {
    return c.redirect(`${base}/calendar?google=error`);
  }

  const stateData = await verifyOAuthState(state, c.env.JWT_SECRET);
  if (!stateData || stateData.purpose !== "google_calendar" || !stateData.userId || !stateData.orgId) {
    return c.redirect(`${base}/calendar?google=error`);
  }

  const { exchangeGoogleCalendarCode, googleCalendarRedirectUri, syncGoogleCalendarEvents } =
    await import("../utils/googleCalendar");
  const redirectUri = googleCalendarRedirectUri(appUrl(c.req.raw, c.env));
  const tokens = await exchangeGoogleCalendarCode(c.env, code, redirectUri);
  if (!tokens) {
    return c.redirect(`${base}/calendar?google=error`);
  }

  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO google_calendar_tokens (user_id, organization_id, refresh_token, access_token, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, organization_id) DO UPDATE SET
       refresh_token = excluded.refresh_token,
       access_token = excluded.access_token,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  )
    .bind(
      stateData.userId,
      stateData.orgId,
      tokens.refresh_token,
      tokens.access_token,
      ts + tokens.expires_in * 1000,
      ts,
    )
    .run();

  try {
    const from = startOfDay(now()) - 86400000 * 30;
    const to = endOfDay(now()) + 86400000 * 90;
    await syncGoogleCalendarEvents(
      c.env.DB,
      c.env,
      stateData.userId,
      stateData.orgId,
      from,
      to,
    );
  } catch {
    /* sync optional on connect */
  }

  return c.redirect(`${base}/calendar?google=connected`);
});

app.post("/integrations/google-calendar/sync", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const body = await c.req.json<{ orgId?: string }>();
  if (!body.orgId) return c.json({ error: "orgId required" }, 400);

  const member = await requireOrgPermission(c, user.id, body.orgId, "events:read");
  if (member instanceof Response) return member;

  const from = startOfDay(now()) - 86400000 * 30;
  const to = endOfDay(now()) + 86400000 * 365;

  try {
    const { syncGoogleCalendarEvents } = await import("../utils/googleCalendar");
    const result = await syncGoogleCalendarEvents(c.env.DB, c.env, user.id, body.orgId, from, to);
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Sync failed" }, 400);
  }
});

app.delete("/integrations/google-calendar", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.query("orgId");
  if (!orgId) return c.json({ error: "orgId required" }, 400);

  await c.env.DB.prepare(
    "DELETE FROM google_calendar_events WHERE user_id = ? AND organization_id = ?",
  )
    .bind(user.id, orgId)
    .run();
  await c.env.DB.prepare(
    "DELETE FROM google_calendar_tokens WHERE user_id = ? AND organization_id = ?",
  )
    .bind(user.id, orgId)
    .run();

  return c.json({ ok: true });
});

// ── Web Push ──

app.get("/push/vapid-public-key", async (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ configured: false, publicKey: null });
  return c.json({ configured: true, publicKey: key });
});

app.post("/push/subscribe", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const body = await c.req.json<{ endpoint?: string; p256dh?: string; auth?: string }>();
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return c.json({ error: "endpoint, p256dh, auth required" }, 400);
  }

  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth`,
  )
    .bind(id, user.id, body.endpoint, body.p256dh, body.auth, now())
    .run();

  return c.json({ ok: true });
});

app.delete("/push/subscribe", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const body = await c.req.json<{ endpoint?: string }>().catch(() => ({ endpoint: undefined }));
  if (body.endpoint) {
    await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
      .bind(user.id, body.endpoint)
      .run();
  } else {
    await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(user.id).run();
  }
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
