import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { permissionsForRole, requireOrgPermission } from "../utils/permissions";
import {
  requireOrgFeature,
  getOrgSubscription,
  writeAuditLog,
  checkMemberLimit,
  checkTeamLimit,
} from "../utils/subscriptions";
import {
  addUserToDefaultTeam,
  getTeamInOrg,
  isActiveOrgMember,
  isTeamLead,
  isTeamMember,
  isValidTeamColor,
  requireTeamMembersAccess,
} from "../utils/teams";
import { frontendUrl } from "../utils/email";
import { newId, now } from "../utils/helpers";
import { resolveBillingProvider } from "../utils/payments";
import { mergeOrgSettings, parseOrgSettings, serializeOrgSettings } from "../utils/orgSettings";
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES, logoExtension, orgLogoKey } from "../utils/storage";

export const orgAdminRoutes = new Hono<{ Bindings: Env }>();

orgAdminRoutes.get("/organizations/:orgId/permissions", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const membership = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (membership instanceof Response) return membership;

  const subscription = await getOrgSubscription(c.env.DB, orgId);
  return c.json({
    role: membership.role,
    permissions: permissionsForRole(membership.role),
    subscription,
  });
});

orgAdminRoutes.patch("/organizations/:orgId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ name?: string; timezone?: string }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return c.json({ error: "name cannot be empty" }, 400);
    updates.push("name = ?");
    values.push(name);
  }
  if (body.timezone !== undefined) {
    const timezone = body.timezone.trim();
    if (!timezone) return c.json({ error: "timezone cannot be empty" }, 400);
    updates.push("timezone = ?");
    values.push(timezone);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);

  updates.push("updated_at = ?");
  values.push(now(), orgId);

  await c.env.DB.prepare(`UPDATE organizations SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.updated", "organization", orgId, body);

  const org = await c.env.DB.prepare(
    "SELECT id, name, slug, timezone FROM organizations WHERE id = ?",
  )
    .bind(orgId)
    .first<{ id: string; name: string; slug: string; timezone: string }>();

  return c.json({ ok: true, organization: org });
});

orgAdminRoutes.get("/organizations/:orgId/settings", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (access instanceof Response) return access;

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

  return c.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      status: org.status,
      deactivatedAt: org.deactivated_at,
      deleteScheduledAt: org.delete_scheduled_at,
      hasLogo: Boolean(org.logo_r2_key),
      settings: parseOrgSettings(org.settings_json),
    },
  });
});

orgAdminRoutes.patch("/organizations/:orgId/settings", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.json<{
    workHours?: { start?: string; end?: string };
    workDays?: number[];
    calendarPolicy?: "own_teams" | "all_teams";
  }>();
  const org = await c.env.DB.prepare("SELECT settings_json FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ settings_json: string | null }>();
  if (!org) return c.json({ error: "Not found" }, 404);

  const next = mergeOrgSettings(org.settings_json, body);
  if (next.workHours.start >= next.workHours.end) {
    return c.json({ error: "Work start must be before work end" }, 400);
  }

  await c.env.DB.prepare("UPDATE organizations SET settings_json = ?, updated_at = ? WHERE id = ?")
    .bind(serializeOrgSettings(next), now(), orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.settings_updated", "organization", orgId, body);
  return c.json({ ok: true, settings: next });
});

orgAdminRoutes.post("/organizations/:orgId/logo", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (!LOGO_MIME_TYPES.has(file.type)) {
    return c.json({ error: "Only PNG, JPEG, or WebP images are allowed" }, 400);
  }
  if (file.size > LOGO_MAX_BYTES) {
    return c.json({ error: "Logo must be 2MB or smaller" }, 400);
  }

  const ext = logoExtension(file.type);
  if (!ext) return c.json({ error: "Unsupported image type" }, 400);

  const org = await c.env.DB.prepare("SELECT logo_r2_key FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ logo_r2_key: string | null }>();
  if (!org) return c.json({ error: "Not found" }, 404);

  const key = orgLogoKey(orgId, ext);
  const bytes = await file.arrayBuffer();
  await c.env.FILES.put(key, bytes, {
    httpMetadata: { contentType: file.type },
  });

  if (org.logo_r2_key && org.logo_r2_key !== key) {
    await c.env.FILES.delete(org.logo_r2_key);
  }

  await c.env.DB.prepare("UPDATE organizations SET logo_r2_key = ?, updated_at = ? WHERE id = ?")
    .bind(key, now(), orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.logo_updated", "organization", orgId);
  return c.json({ ok: true, hasLogo: true });
});

orgAdminRoutes.delete("/organizations/:orgId/logo", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const org = await c.env.DB.prepare("SELECT logo_r2_key FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ logo_r2_key: string | null }>();
  if (!org) return c.json({ error: "Not found" }, 404);

  if (org.logo_r2_key) await c.env.FILES.delete(org.logo_r2_key);

  await c.env.DB.prepare("UPDATE organizations SET logo_r2_key = NULL, updated_at = ? WHERE id = ?")
    .bind(now(), orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.logo_removed", "organization", orgId);
  return c.json({ ok: true });
});

orgAdminRoutes.get("/organizations/:orgId/members", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "members:read");
  if (access instanceof Response) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.user_id, m.role, m.status, m.joined_at, u.name, u.email, u.avatar_url
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ?
     ORDER BY
       CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
       u.name`,
  )
    .bind(orgId)
    .all();

  const { results: teamLinks } = await c.env.DB.prepare(
    `SELECT tm.user_id, t.id, t.name, t.color
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE t.organization_id = ?
     ORDER BY t.name`,
  )
    .bind(orgId)
    .all();

  const teamsByUser = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of teamLinks ?? []) {
    const r = row as Record<string, unknown>;
    const userId = String(r.user_id);
    const list = teamsByUser.get(userId) ?? [];
    list.push({ id: String(r.id), name: String(r.name), color: String(r.color) });
    teamsByUser.set(userId, list);
  }

  const members = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const userId = String(r.user_id);
    return { ...r, teams: teamsByUser.get(userId) ?? [] };
  });

  const limits = await checkMemberLimit(c.env.DB, orgId);
  return c.json({ members, limits });
});

orgAdminRoutes.patch("/organizations/:orgId/members/:memberUserId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const memberUserId = c.req.param("memberUserId");

  const access = await requireOrgPermission(c, user.id, orgId, "members:manage");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ role?: string; status?: string }>();
  const target = await c.env.DB.prepare(
    "SELECT id, role FROM memberships WHERE organization_id = ? AND user_id = ?",
  )
    .bind(orgId, memberUserId)
    .first<{ id: string; role: string }>();

  if (!target) return c.json({ error: "Member not found" }, 404);
  if (target.role === "owner" && access.role !== "owner") {
    return c.json({ error: "Only owner can modify owner role" }, 403);
  }
  if (memberUserId === user.id && body.role && body.role !== access.role) {
    return c.json({ error: "Cannot change own role" }, 400);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.role) {
    updates.push("role = ?");
    values.push(body.role);
  }
  if (body.status) {
    updates.push("status = ?");
    values.push(body.status);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);

  values.push(orgId, memberUserId);
  await c.env.DB.prepare(
    `UPDATE memberships SET ${updates.join(", ")} WHERE organization_id = ? AND user_id = ?`,
  )
    .bind(...values)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "member.updated", "membership", memberUserId, body);
  return c.json({ ok: true });
});

orgAdminRoutes.delete("/organizations/:orgId/members/:memberUserId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const memberUserId = c.req.param("memberUserId");

  const access = await requireOrgPermission(c, user.id, orgId, "members:manage");
  if (access instanceof Response) return access;

  const target = await c.env.DB.prepare(
    "SELECT role FROM memberships WHERE organization_id = ? AND user_id = ?",
  )
    .bind(orgId, memberUserId)
    .first<{ role: string }>();

  if (!target) return c.json({ error: "Member not found" }, 404);
  if (target.role === "owner") return c.json({ error: "Cannot remove owner" }, 400);
  if (memberUserId === user.id) return c.json({ error: "Cannot remove yourself" }, 400);

  await c.env.DB.prepare(
    `DELETE FROM team_members WHERE user_id = ? AND team_id IN (
       SELECT id FROM teams WHERE organization_id = ?
     )`,
  )
    .bind(memberUserId, orgId)
    .run();

  await c.env.DB.prepare("DELETE FROM memberships WHERE organization_id = ? AND user_id = ?")
    .bind(orgId, memberUserId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "member.removed", "membership", memberUserId);
  return c.json({ ok: true });
});

orgAdminRoutes.get("/organizations/:orgId/subscription", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "billing:read");
  if (access instanceof Response) return access;

  const subscription = await getOrgSubscription(c.env.DB, orgId);
  const { results: plans } = await c.env.DB.prepare(
    `SELECT id, code, name, description, price_monthly, price_yearly, max_members, features_json,
            stripe_price_monthly_id, stripe_price_yearly_id
     FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order`,
  ).all();

  return c.json({ subscription, plans: plans ?? [], billingProvider: resolveBillingProvider(c.env) });
});

orgAdminRoutes.get("/organizations/:orgId/billing/history", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "billing:read");
  if (access instanceof Response) return access;

  const limit = Math.min(Number(c.req.query("limit") ?? 30), 100);
  const { results } = await c.env.DB.prepare(
    `SELECT id, action, metadata_json, created_at
     FROM audit_logs
     WHERE organization_id = ? AND action LIKE 'billing.%'
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(orgId, limit)
    .all();

  const events = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      action: String(r.action),
      metadata: r.metadata_json ? JSON.parse(String(r.metadata_json)) : null,
      createdAt: Number(r.created_at),
    };
  });

  return c.json({ events });
});

orgAdminRoutes.post("/organizations/:orgId/members/invite", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "members:manage");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ email: string; role?: string }>();
  if (!body.email?.trim()) return c.json({ error: "email required" }, 400);

  const limits = await checkMemberLimit(c.env.DB, orgId);
  if (!limits.ok) {
    return c.json({ error: "Member limit reached", code: "MEMBER_LIMIT", ...limits }, 402);
  }

  const invitee = await c.env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?")
    .bind(body.email.trim().toLowerCase())
    .first<{ id: string; name: string; email: string }>();

  if (!invitee) return c.json({ error: "User not found. They must register first.", code: "USER_NOT_FOUND" }, 404);

  const existing = await c.env.DB.prepare(
    "SELECT id, status FROM memberships WHERE organization_id = ? AND user_id = ?",
  )
    .bind(orgId, invitee.id)
    .first<{ id: string; status: string }>();

  if (existing?.status === "active") return c.json({ error: "Already a member" }, 409);

  const activeOrgCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as c FROM memberships WHERE user_id = ? AND status = 'active'",
  )
    .bind(invitee.id)
    .first<{ c: number }>();
  if ((activeOrgCount?.c ?? 0) > 0 && !existing) {
    return c.json({ error: "This user already belongs to another organization.", code: "ONE_ORG_POLICY" }, 409);
  }

  const role = body.role ?? "member";
  const ts = now();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE memberships SET role = ?, status = 'active', invited_by = ?, joined_at = ? WHERE id = ?",
    )
      .bind(role, user.id, ts, existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO memberships (id, organization_id, user_id, role, status, invited_by, joined_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    )
      .bind(newId(), orgId, invitee.id, role, user.id, ts)
      .run();
  }

  await addUserToDefaultTeam(c.env.DB, orgId, invitee.id);

  await writeAuditLog(c.env.DB, orgId, user.id, "member.invited", "user", invitee.id, { role });
  return c.json({ ok: true, member: { userId: invitee.id, name: invitee.name, email: invitee.email, role } }, 201);
});

// ── Invite links ──

orgAdminRoutes.get("/organizations/:orgId/invites", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const access = await requireOrgPermission(c, user.id, orgId, "members:read");
  if (access instanceof Response) return access;

  const { listOrgInvites } = await import("../utils/invites");
  const invites = await listOrgInvites(c.env.DB, orgId);
  return c.json({ invites });
});

orgAdminRoutes.post("/organizations/:orgId/invites", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const access = await requireOrgPermission(c, user.id, orgId, "members:manage");
  if (access instanceof Response) return access;

  const limits = await checkMemberLimit(c.env.DB, orgId);
  if (!limits.ok) return c.json({ error: "Member limit reached", code: "MEMBER_LIMIT", ...limits }, 402);

  const body = await c.req.json<{
    email?: string;
    emailDomain?: string;
    role?: string;
    inviteType?: "single" | "multi";
    maxUses?: number | null;
    expiryDays?: number;
    label?: string;
  }>();
  const { createOrgInvite } = await import("../utils/invites");
  const { sendOrgInviteEmail } = await import("../utils/email");

  let created;
  try {
    created = await createOrgInvite(c.env.DB, orgId, user.id, {
      email: body.email,
      emailDomain: body.emailDomain,
      role: body.role,
      inviteType: body.inviteType ?? "multi",
      maxUses: body.maxUses,
      expiryDays: body.expiryDays,
      label: body.label,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid invite options" }, 400);
  }
  const { rawToken, expiresAt, id: inviteId } = created;

  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(orgId).first<{ name: string }>();
  const inviteUrl = `${frontendUrl(c.req.raw, c.env)}/invite/${rawToken}`;
  let emailResult: { sent: boolean; devLink?: string } | undefined;

  if (body.email?.trim()) {
    emailResult = await sendOrgInviteEmail(c.env, c.req.raw, body.email.trim(), org?.name ?? "조직", inviteUrl);
  }

  await writeAuditLog(c.env.DB, orgId, user.id, "invite.link_created", "org_invite", inviteId, {
    email: body.email ?? null,
    emailDomain: body.emailDomain ?? null,
    role: body.role ?? "member",
    inviteType: body.inviteType ?? "multi",
    maxUses: body.maxUses ?? null,
    label: body.label ?? null,
  });

  return c.json({ inviteUrl, expiresAt, inviteId, email: emailResult }, 201);
});

orgAdminRoutes.delete("/organizations/:orgId/invites/:inviteId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const inviteId = c.req.param("inviteId");
  const access = await requireOrgPermission(c, user.id, orgId, "members:manage");
  if (access instanceof Response) return access;

  const { revokeOrgInvite } = await import("../utils/invites");
  const revoked = await revokeOrgInvite(c.env.DB, orgId, inviteId);
  if (!revoked) return c.json({ error: "Invite not found" }, 404);

  await writeAuditLog(c.env.DB, orgId, user.id, "invite.revoked", "org_invite", inviteId);
  return c.json({ ok: true });
});

orgAdminRoutes.get("/invites/:token", async (c) => {
  const { findValidInvite } = await import("../utils/invites");
  const invite = await findValidInvite(c.env.DB, c.req.param("token"));
  if (!invite) return c.json({ valid: false, error: "Invalid or expired invite" }, 404);
  return c.json({
    valid: true,
    organizationName: invite.orgName,
    role: invite.role,
    email: invite.email,
    emailDomain: invite.emailDomain,
    inviteType: invite.inviteType,
    expiresAt: invite.expiresAt,
  });
});

orgAdminRoutes.post("/invites/:token/accept", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const { findValidInvite, acceptOrgInvite } = await import("../utils/invites");
  const token = c.req.param("token");
  const invite = await findValidInvite(c.env.DB, token);
  if (!invite) return c.json({ error: "Invalid or expired invite" }, 404);

  const result = await acceptOrgInvite(c.env.DB, invite.id, user.id, user.email);
  if ("error" in result) return c.json({ error: result.error }, 400);

  await addUserToDefaultTeam(c.env.DB, result.organizationId, user.id);

  await writeAuditLog(c.env.DB, result.organizationId, user.id, "invite.redeemed", "org_invite", invite.id, {
    userId: user.id,
    email: user.email,
  });
  return c.json({ ok: true, organizationId: result.organizationId });
});

// ── Teams ──

orgAdminRoutes.get("/organizations/:orgId/teams/manage", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:read");
  if (access instanceof Response) return access;

  const isAdmin = access.role === "owner" || access.role === "admin";
  const limits = await checkTeamLimit(c.env.DB, orgId);

  const { results } = isAdmin
    ? await c.env.DB.prepare(
        `SELECT t.id, t.name, t.color, t.description, t.created_at,
                (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
         FROM teams t
         WHERE t.organization_id = ?
         ORDER BY t.name`,
      )
        .bind(orgId)
        .all()
    : await c.env.DB.prepare(
        `SELECT t.id, t.name, t.color, t.description, t.created_at,
                (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
         FROM teams t
         INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
         WHERE t.organization_id = ?
         ORDER BY t.name`,
      )
        .bind(user.id, orgId)
        .all();

  const teams = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      description: r.description ?? null,
      memberCount: Number(r.member_count ?? 0),
      createdAt: r.created_at,
    };
  });

  return c.json({ teams, limits });
});

orgAdminRoutes.get("/organizations/:orgId/teams/:teamId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:read");
  if (access instanceof Response) return access;

  const team = await getTeamInOrg(c.env.DB, orgId, teamId);
  if (!team) return c.json({ error: "Team not found" }, 404);

  const isAdmin = access.role === "owner" || access.role === "admin";
  if (!isAdmin && !(await isTeamMember(c.env.DB, teamId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT tm.user_id, tm.role, u.name, u.email, u.avatar_url
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ?
     ORDER BY CASE tm.role WHEN 'lead' THEN 0 ELSE 1 END, u.name`,
  )
    .bind(teamId)
    .all();

  const members = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      userId: r.user_id,
      role: r.role,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatar_url ?? null,
    };
  });

  const canManage =
    isAdmin || (await isTeamLead(c.env.DB, teamId, user.id));

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
      description: team.description,
      departmentId: team.department_id,
      memberCount: members.length,
    },
    members,
    canManage,
  });
});

orgAdminRoutes.post("/organizations/:orgId/teams", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:manage");
  if (access instanceof Response) return access;

  const feature = await requireOrgFeature(c, orgId, "teams");
  if (feature instanceof Response) return feature;

  const limits = await checkTeamLimit(c.env.DB, orgId);
  if (!limits.ok) {
    return c.json({ error: "Team limit reached", code: "TEAM_LIMIT", ...limits }, 402);
  }

  const body = await c.req.json<{
    name: string;
    color?: string;
    description?: string;
    departmentId?: string | null;
  }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name required" }, 400);

  const color = body.color?.trim() || "#4A9FE8";
  if (!isValidTeamColor(color)) return c.json({ error: "Invalid color" }, 400);

  let departmentId: string | null = body.departmentId ?? null;
  if (departmentId) {
    const dept = await c.env.DB.prepare(
      "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
    )
      .bind(departmentId, orgId)
      .first();
    if (!dept) return c.json({ error: "Department not found" }, 400);
  }

  const teamId = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO teams (id, organization_id, department_id, name, description, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(teamId, orgId, departmentId, name, body.description?.trim() || null, color, ts)
    .run();

  await c.env.DB.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'lead')")
    .bind(teamId, user.id)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.created", "team", teamId, { name, color });

  return c.json({ ok: true, team: { id: teamId, name, color, description: body.description?.trim() || null } }, 201);
});

orgAdminRoutes.patch("/organizations/:orgId/teams/:teamId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:manage");
  if (access instanceof Response) return access;

  const team = await getTeamInOrg(c.env.DB, orgId, teamId);
  if (!team) return c.json({ error: "Team not found" }, 404);

  const body = await c.req.json<{
    name?: string;
    color?: string;
    description?: string | null;
    departmentId?: string | null;
  }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return c.json({ error: "name cannot be empty" }, 400);
    updates.push("name = ?");
    values.push(name);
  }
  if (body.color !== undefined) {
    if (!isValidTeamColor(body.color)) return c.json({ error: "Invalid color" }, 400);
    updates.push("color = ?");
    values.push(body.color);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description?.trim() || null);
  }
  if (body.departmentId !== undefined) {
    if (body.departmentId) {
      const dept = await c.env.DB.prepare(
        "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
      )
        .bind(body.departmentId, orgId)
        .first();
      if (!dept) return c.json({ error: "Department not found" }, 400);
    }
    updates.push("department_id = ?");
    values.push(body.departmentId);
  }
  if (!updates.length) return c.json({ error: "Nothing to update" }, 400);

  values.push(teamId);
  await c.env.DB.prepare(`UPDATE teams SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.updated", "team", teamId, body);
  return c.json({ ok: true });
});

orgAdminRoutes.delete("/organizations/:orgId/teams/:teamId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:manage");
  if (access instanceof Response) return access;

  const team = await getTeamInOrg(c.env.DB, orgId, teamId);
  if (!team) return c.json({ error: "Team not found" }, 404);

  const teamCount = await c.env.DB.prepare("SELECT COUNT(*) as c FROM teams WHERE organization_id = ?")
    .bind(orgId)
    .first<{ c: number }>();
  if ((teamCount?.c ?? 0) <= 1) {
    return c.json({ error: "Cannot delete the last team in the organization" }, 400);
  }

  const eventCount = await c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE team_id = ?")
    .bind(teamId)
    .first<{ c: number }>();
  if ((eventCount?.c ?? 0) > 0) {
    return c.json({ error: "Team has linked events. Reassign or delete them first." }, 400);
  }

  await c.env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(teamId).run();
  await writeAuditLog(c.env.DB, orgId, user.id, "team.deleted", "team", teamId, { name: team.name });
  return c.json({ ok: true });
});

orgAdminRoutes.post("/organizations/:orgId/teams/:teamId/members", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");

  const access = await requireTeamMembersAccess(c, user.id, orgId, teamId);
  if (access instanceof Response) return access;
  if (!access.canManageTeam) return c.json({ error: "Forbidden" }, 403);

  const team = await getTeamInOrg(c.env.DB, orgId, teamId);
  if (!team) return c.json({ error: "Team not found" }, 404);

  const body = await c.req.json<{ userId: string; role?: string }>();
  if (!body.userId) return c.json({ error: "userId required" }, 400);

  if (!(await isActiveOrgMember(c.env.DB, orgId, body.userId))) {
    return c.json({ error: "User is not an active organization member" }, 400);
  }

  const role = body.role === "lead" ? "lead" : "member";
  const existing = await c.env.DB.prepare(
    "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
  )
    .bind(teamId, body.userId)
    .first();

  if (existing) {
    await c.env.DB.prepare("UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?")
      .bind(role, teamId, body.userId)
      .run();
  } else {
    await c.env.DB.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)")
      .bind(teamId, body.userId, role)
      .run();
  }

  await writeAuditLog(c.env.DB, orgId, user.id, "team.member_added", "team", teamId, {
    userId: body.userId,
    role,
  });
  return c.json({ ok: true }, 201);
});

orgAdminRoutes.patch("/organizations/:orgId/teams/:teamId/members/:memberUserId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");
  const memberUserId = c.req.param("memberUserId");

  const access = await requireTeamMembersAccess(c, user.id, orgId, teamId);
  if (access instanceof Response) return access;
  if (!access.canManageTeam) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ role?: string }>();
  if (!body.role || !["lead", "member"].includes(body.role)) {
    return c.json({ error: "role must be lead or member" }, 400);
  }

  const member = await c.env.DB.prepare(
    "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
  )
    .bind(teamId, memberUserId)
    .first();
  if (!member) return c.json({ error: "Team member not found" }, 404);

  await c.env.DB.prepare("UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?")
    .bind(body.role, teamId, memberUserId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.member_updated", "team", teamId, {
    userId: memberUserId,
    role: body.role,
  });
  return c.json({ ok: true });
});

orgAdminRoutes.delete("/organizations/:orgId/teams/:teamId/members/:memberUserId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");
  const memberUserId = c.req.param("memberUserId");

  const access = await requireTeamMembersAccess(c, user.id, orgId, teamId);
  if (access instanceof Response) return access;
  if (!access.canManageTeam) return c.json({ error: "Forbidden" }, 403);

  const member = await c.env.DB.prepare(
    "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
  )
    .bind(teamId, memberUserId)
    .first<{ role: string }>();
  if (!member) return c.json({ error: "Team member not found" }, 404);

  const memberCount = await c.env.DB.prepare("SELECT COUNT(*) as c FROM team_members WHERE team_id = ?")
    .bind(teamId)
    .first<{ c: number }>();
  if ((memberCount?.c ?? 0) <= 1) {
    return c.json({ error: "Team must have at least one member" }, 400);
  }

  if (member.role === "lead") {
    const leadCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM team_members WHERE team_id = ? AND role = 'lead'",
    )
      .bind(teamId)
      .first<{ c: number }>();
    if ((leadCount?.c ?? 0) <= 1) {
      return c.json({ error: "Assign another lead before removing this member" }, 400);
    }
  }

  await c.env.DB.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(teamId, memberUserId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.member_removed", "team", teamId, {
    userId: memberUserId,
  });
  return c.json({ ok: true });
});

orgAdminRoutes.get("/organizations/:orgId/teams/:teamId/summary", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const teamId = c.req.param("teamId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:read");
  if (access instanceof Response) return access;

  const team = await getTeamInOrg(c.env.DB, orgId, teamId);
  if (!team) return c.json({ error: "Team not found" }, 404);

  const isAdmin = access.role === "owner" || access.role === "admin";
  if (!isAdmin && !(await isTeamMember(c.env.DB, teamId, user.id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const from = now();
  const to = from + 7 * 86400000;

  const eventCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as c FROM events WHERE team_id = ? AND start_at < ? AND end_at > ?",
  )
    .bind(teamId, to, from)
    .first<{ c: number }>();

  const { results: upcomingEvents } = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, all_day
     FROM events WHERE team_id = ? AND start_at >= ? AND start_at < ?
     ORDER BY start_at ASC LIMIT 5`,
  )
    .bind(teamId, from, to)
    .all();

  const taskStats = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as c FROM tasks WHERE team_id = ? GROUP BY status`,
  )
    .bind(teamId)
    .all();

  const tasks = { todo: 0, doing: 0, done: 0 };
  for (const row of taskStats ?? []) {
    const r = row as Record<string, unknown>;
    const status = String(r.status);
    const count = Number(r.c ?? 0);
    if (status in tasks) tasks[status as keyof typeof tasks] = count;
  }

  return c.json({
    eventsThisWeek: eventCount?.c ?? 0,
    upcomingEvents: (upcomingEvents ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id,
        title: r.title,
        startAt: r.start_at,
        endAt: r.end_at,
        allDay: Boolean(r.all_day),
      };
    }),
    tasks,
  });
});

// ── Departments ──

orgAdminRoutes.get("/organizations/:orgId/departments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (access instanceof Response) return access;

  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.name, d.parent_id, d.sort_order,
            (SELECT COUNT(*) FROM teams t WHERE t.department_id = d.id) as team_count
     FROM departments d
     WHERE d.organization_id = ?
     ORDER BY d.sort_order, d.name`,
  )
    .bind(orgId)
    .all();

  const departments = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      parentId: r.parent_id ?? null,
      sortOrder: r.sort_order ?? 0,
      teamCount: Number(r.team_count ?? 0),
    };
  });

  return c.json({ departments });
});

orgAdminRoutes.post("/organizations/:orgId/departments", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ name: string; parentId?: string | null }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name required" }, 400);

  if (body.parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
    )
      .bind(body.parentId, orgId)
      .first();
    if (!parent) return c.json({ error: "Parent department not found" }, 400);
  }

  const deptId = newId();
  await c.env.DB.prepare(
    `INSERT INTO departments (id, organization_id, name, parent_id, sort_order)
     VALUES (?, ?, ?, ?, 0)`,
  )
    .bind(deptId, orgId, name, body.parentId ?? null)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "department.created", "department", deptId, { name });
  return c.json({ ok: true, department: { id: deptId, name } }, 201);
});

orgAdminRoutes.patch("/organizations/:orgId/departments/:deptId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const deptId = c.req.param("deptId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ name?: string }>();
  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);

  const dept = await c.env.DB.prepare(
    "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
  )
    .bind(deptId, orgId)
    .first();
  if (!dept) return c.json({ error: "Department not found" }, 404);

  await c.env.DB.prepare("UPDATE departments SET name = ? WHERE id = ?")
    .bind(body.name.trim(), deptId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "department.updated", "department", deptId, body);
  return c.json({ ok: true });
});

orgAdminRoutes.delete("/organizations/:orgId/departments/:deptId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const deptId = c.req.param("deptId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const dept = await c.env.DB.prepare(
    "SELECT id FROM departments WHERE id = ? AND organization_id = ?",
  )
    .bind(deptId, orgId)
    .first();
  if (!dept) return c.json({ error: "Department not found" }, 404);

  const child = await c.env.DB.prepare("SELECT id FROM departments WHERE parent_id = ? LIMIT 1")
    .bind(deptId)
    .first();
  if (child) return c.json({ error: "Remove child departments first" }, 400);

  const teams = await c.env.DB.prepare("SELECT id FROM teams WHERE department_id = ? LIMIT 1")
    .bind(deptId)
    .first();
  if (teams) return c.json({ error: "Reassign teams before deleting department" }, 400);

  await c.env.DB.prepare("DELETE FROM departments WHERE id = ?").bind(deptId).run();
  await writeAuditLog(c.env.DB, orgId, user.id, "department.deleted", "department", deptId);
  return c.json({ ok: true });
});

// ── Organization lifecycle ──

const DELETION_GRACE_MS = 30 * 86400000;

orgAdminRoutes.post("/organizations/:orgId/deactivate", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;
  if (access.role !== "owner") return c.json({ error: "Only owner can deactivate organization" }, 403);

  const org = await c.env.DB.prepare("SELECT status FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ status: string }>();
  if (!org) return c.json({ error: "Not found" }, 404);
  if (org.status === "pending_deletion") {
    return c.json({ error: "Organization already scheduled for deletion" }, 400);
  }

  const ts = now();
  const deleteAt = ts + DELETION_GRACE_MS;
  await c.env.DB.prepare(
    `UPDATE organizations SET status = 'pending_deletion', deactivated_at = ?, delete_scheduled_at = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(ts, deleteAt, ts, orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.deactivate_scheduled", "organization", orgId, {
    deleteScheduledAt: deleteAt,
  });
  return c.json({ ok: true, deleteScheduledAt: deleteAt });
});

orgAdminRoutes.post("/organizations/:orgId/reactivate", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;
  if (access.role !== "owner") return c.json({ error: "Only owner can reactivate organization" }, 403);

  const org = await c.env.DB.prepare(
    "SELECT status, delete_scheduled_at FROM organizations WHERE id = ?",
  )
    .bind(orgId)
    .first<{ status: string; delete_scheduled_at: number | null }>();
  if (!org) return c.json({ error: "Not found" }, 404);
  if (org.status !== "pending_deletion") {
    return c.json({ error: "Organization is not scheduled for deletion" }, 400);
  }

  const ts = now();
  await c.env.DB.prepare(
    `UPDATE organizations SET status = 'active', deactivated_at = NULL, delete_scheduled_at = NULL, updated_at = ?
     WHERE id = ?`,
  )
    .bind(ts, orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "org.reactivated", "organization", orgId);
  return c.json({ ok: true });
});

// ── Team creation requests ──

orgAdminRoutes.get("/organizations/:orgId/team-requests", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:read");
  if (access instanceof Response) return access;

  const isAdmin = access.role === "owner" || access.role === "admin";
  const { results } = isAdmin
    ? await c.env.DB.prepare(
        `SELECT r.*, u.name as requester_name
         FROM team_creation_requests r
         JOIN users u ON u.id = r.requester_id
         WHERE r.organization_id = ?
         ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`,
      )
        .bind(orgId)
        .all()
    : await c.env.DB.prepare(
        `SELECT r.*, u.name as requester_name
         FROM team_creation_requests r
         JOIN users u ON u.id = r.requester_id
         WHERE r.organization_id = ? AND r.requester_id = ?
         ORDER BY r.created_at DESC`,
      )
        .bind(orgId, user.id)
        .all();

  const requests = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      departmentId: r.department_id,
      status: r.status,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      rejectReason: r.reject_reason,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    };
  });

  return c.json({ requests });
});

orgAdminRoutes.post("/organizations/:orgId/team-requests", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:read");
  if (access instanceof Response) return access;
  if (access.role === "owner" || access.role === "admin") {
    return c.json({ error: "Admins can create teams directly" }, 400);
  }

  const body = await c.req.json<{
    name: string;
    description?: string;
    color?: string;
    departmentId?: string | null;
  }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name required" }, 400);

  const pending = await c.env.DB.prepare(
    `SELECT id FROM team_creation_requests
     WHERE organization_id = ? AND requester_id = ? AND status = 'pending'`,
  )
    .bind(orgId, user.id)
    .first();
  if (pending) return c.json({ error: "You already have a pending team request" }, 409);

  const color = body.color?.trim() || "#4A9FE8";
  if (!isValidTeamColor(color)) return c.json({ error: "Invalid color" }, 400);

  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO team_creation_requests (
      id, organization_id, requester_id, name, description, color, department_id, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(
      id,
      orgId,
      user.id,
      name,
      body.description?.trim() || null,
      color,
      body.departmentId ?? null,
      now(),
    )
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.request_created", "team_request", id, { name });
  return c.json({ ok: true, id }, 201);
});

orgAdminRoutes.post("/organizations/:orgId/team-requests/:requestId/approve", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const requestId = c.req.param("requestId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:manage");
  if (access instanceof Response) return access;

  const feature = await requireOrgFeature(c, orgId, "teams");
  if (feature instanceof Response) return feature;

  const limits = await checkTeamLimit(c.env.DB, orgId);
  if (!limits.ok) {
    return c.json({ error: "Team limit reached", code: "TEAM_LIMIT", ...limits }, 402);
  }

  const req = await c.env.DB.prepare(
    `SELECT * FROM team_creation_requests WHERE id = ? AND organization_id = ? AND status = 'pending'`,
  )
    .bind(requestId, orgId)
    .first<Record<string, unknown>>();
  if (!req) return c.json({ error: "Request not found" }, 404);

  const teamId = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO teams (id, organization_id, department_id, name, description, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      teamId,
      orgId,
      req.department_id ?? null,
      req.name,
      req.description ?? null,
      req.color ?? "#4A9FE8",
      ts,
    )
    .run();

  await c.env.DB.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'lead')")
    .bind(teamId, req.requester_id)
    .run();

  await c.env.DB.prepare(
    `UPDATE team_creation_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
  )
    .bind(user.id, ts, requestId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.request_approved", "team_request", requestId, {
    teamId,
  });
  return c.json({ ok: true, teamId });
});

orgAdminRoutes.post("/organizations/:orgId/team-requests/:requestId/reject", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const requestId = c.req.param("requestId");

  const access = await requireOrgPermission(c, user.id, orgId, "teams:manage");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ reason?: string }>();
  const req = await c.env.DB.prepare(
    `SELECT id FROM team_creation_requests WHERE id = ? AND organization_id = ? AND status = 'pending'`,
  )
    .bind(requestId, orgId)
    .first();
  if (!req) return c.json({ error: "Request not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE team_creation_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, reject_reason = ?
     WHERE id = ?`,
  )
    .bind(user.id, now(), body.reason?.trim() || null, requestId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "team.request_rejected", "team_request", requestId, body);
  return c.json({ ok: true });
});

// ── Holidays ──

orgAdminRoutes.get("/organizations/:orgId/holidays", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:read");
  if (access instanceof Response) return access;

  const from = c.req.query("from");
  const to = c.req.query("to");

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, date, yearly, created_at FROM org_holidays
     WHERE organization_id = ?
     ORDER BY date`,
  )
    .bind(orgId)
    .all();

  let holidays = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      date: r.date,
      yearly: Boolean(r.yearly),
      createdAt: r.created_at,
    };
  });

  if (from && to) {
    const fromYear = new Date(Number(from)).getFullYear();
    const toYear = new Date(Number(to)).getFullYear();
    holidays = holidays.filter((h) => {
      if (!h.yearly) {
        const ts = new Date(`${h.date}T00:00:00`).getTime();
        return ts >= Number(from) && ts <= Number(to);
      }
      const [, month, day] = h.date.includes("-") && h.date.length === 10
        ? h.date.split("-").map(Number)
        : [0, ...h.date.split("-").map(Number)];
      for (let y = fromYear; y <= toYear; y++) {
        const ts = new Date(y, month - 1, day).getTime();
        if (ts >= Number(from) && ts <= Number(to)) return true;
      }
      return false;
    });
  }

  return c.json({ holidays });
});

orgAdminRoutes.post("/organizations/:orgId/holidays", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const body = await c.req.json<{ name: string; date: string; yearly?: boolean }>();
  const name = body.name?.trim();
  if (!name || !body.date?.trim()) return c.json({ error: "name and date required" }, 400);

  const yearly = body.yearly !== false;
  const date = body.date.trim();
  if (yearly && !/^\d{2}-\d{2}$/.test(date) && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "yearly holiday date must be MM-DD or YYYY-MM-DD" }, 400);
  }
  if (!yearly && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "one-time holiday date must be YYYY-MM-DD" }, 400);
  }

  const normalizedDate = yearly && date.length === 10 ? date.slice(5) : date;
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO org_holidays (id, organization_id, name, date, yearly, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, orgId, name, normalizedDate, yearly ? 1 : 0, now())
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "holiday.created", "org_holiday", id, { name, date });
  return c.json({ ok: true, id }, 201);
});

orgAdminRoutes.delete("/organizations/:orgId/holidays/:holidayId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");
  const holidayId = c.req.param("holidayId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const row = await c.env.DB.prepare(
    "SELECT id FROM org_holidays WHERE id = ? AND organization_id = ?",
  )
    .bind(holidayId, orgId)
    .first();
  if (!row) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare("DELETE FROM org_holidays WHERE id = ?").bind(holidayId).run();
  await writeAuditLog(c.env.DB, orgId, user.id, "holiday.deleted", "org_holiday", holidayId);
  return c.json({ ok: true });
});

// ── Audit logs ──

orgAdminRoutes.get("/organizations/:orgId/audit-logs", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const orgId = c.req.param("orgId");

  const access = await requireOrgPermission(c, user.id, orgId, "org:settings");
  if (access instanceof Response) return access;

  const feature = await requireOrgFeature(c, orgId, "audit_logs");
  if (feature instanceof Response) return feature;

  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata_json, a.created_at,
            u.name as actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.organization_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
  )
    .bind(orgId, limit)
    .all();

  const logs = (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json as string) : null,
      createdAt: r.created_at,
      actorName: r.actor_name ?? "시스템",
    };
  });

  return c.json({ logs });
});
