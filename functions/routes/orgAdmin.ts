import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import { permissionsForRole, requireOrgPermission } from "../utils/permissions";
import {
  checkMemberLimit,
  getOrgSubscription,
  writeAuditLog,
} from "../utils/subscriptions";
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
    "SELECT id, code, name, description, price_monthly, price_yearly, max_members, features_json FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order",
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
