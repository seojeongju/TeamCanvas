import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { permissionsForRole, requireOrgPermission } from "../utils/permissions";
import { requireOrgFeature, getOrgSubscription, writeAuditLog, checkMemberLimit } from "../utils/subscriptions";
import { frontendUrl } from "../utils/email";
import { newId, now } from "../utils/helpers";

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

  const limits = await checkMemberLimit(c.env.DB, orgId);
  return c.json({ members: results ?? [], limits });
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

  return c.json({ subscription, plans: plans ?? [] });
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

  const body = await c.req.json<{ email?: string; role?: string }>();
  const { createOrgInvite } = await import("../utils/invites");
  const { sendOrgInviteEmail } = await import("../utils/email");

  const { rawToken, expiresAt } = await createOrgInvite(c.env.DB, orgId, user.id, {
    email: body.email,
    role: body.role,
  });

  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(orgId).first<{ name: string }>();
  const inviteUrl = `${frontendUrl(c.req.raw, c.env)}/invite/${rawToken}`;
  let emailResult: { sent: boolean; devLink?: string } | undefined;

  if (body.email?.trim()) {
    emailResult = await sendOrgInviteEmail(c.env, c.req.raw, body.email.trim(), org?.name ?? "조직", inviteUrl);
  }

  await writeAuditLog(c.env.DB, orgId, user.id, "invite.link_created", "org_invite", null, {
    email: body.email ?? null,
    role: body.role ?? "member",
  });

  return c.json({ inviteUrl, expiresAt, email: emailResult }, 201);
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

  await writeAuditLog(c.env.DB, result.organizationId, user.id, "invite.accepted", "org_invite", invite.id);
  return c.json({ ok: true, organizationId: result.organizationId });
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
