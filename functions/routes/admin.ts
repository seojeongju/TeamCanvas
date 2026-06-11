import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../utils/auth";
import {
  countPlatformAdmins,
  getPlatformAdminRole,
  isPlatformAdmin,
  requirePlatformAdmin,
} from "../utils/permissions";
import {
  assignOrgPlan,
  createOrgSubscription,
  getOrgSubscription,
  listPlans,
  writeAuditLog,
} from "../utils/subscriptions";
import { newId, now } from "../utils/helpers";

export const adminRoutes = new Hono<{ Bindings: Env }>();

async function createOrganizationForOwner(
  db: D1Database,
  ownerUserId: string,
  name: string,
  slug: string,
): Promise<{ id: string; name: string; slug: string }> {
  const orgId = newId();
  const ts = now();

  await db
    .prepare(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(orgId, name, slug, ownerUserId, ts, ts)
    .run();

  await db
    .prepare(
      `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?)`,
    )
    .bind(newId(), orgId, ownerUserId, ts)
    .run();

  const defaultTeamId = newId();
  await db
    .prepare(
      `INSERT INTO teams (id, organization_id, name, color, created_at) VALUES (?, ?, '기본 팀', '#4A9FE8', ?)`,
    )
    .bind(defaultTeamId, orgId, ts)
    .run();

  await db
    .prepare(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'lead')`)
    .bind(defaultTeamId, ownerUserId)
    .run();

  await createOrgSubscription(db, orgId, "plan_free", { status: "active" });
  return { id: orgId, name, slug };
}

adminRoutes.get("/me", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const role = await getPlatformAdminRole(c.env.DB, user.id);
  return c.json({ isPlatformAdmin: Boolean(role), role });
});

adminRoutes.post("/bootstrap", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;

  const count = await countPlatformAdmins(c.env.DB);
  if (count > 0) return c.json({ error: "Platform admin already exists" }, 403);

  const ts = now();
  await c.env.DB.prepare(
    "INSERT INTO platform_admins (user_id, role, granted_at) VALUES (?, 'super_admin', ?)",
  )
    .bind(user.id, ts)
    .run();

  return c.json({ ok: true, role: "super_admin" });
});

adminRoutes.get("/dashboard", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const [orgs, users, subs, plans] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM organizations WHERE status = 'active'").first<{ c: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>(),
    c.env.DB.prepare(
      `SELECT s.status, COUNT(*) as c
       FROM organization_subscriptions s
       GROUP BY s.status`,
    ).all<{ status: string; c: number }>(),
    c.env.DB.prepare(
      `SELECT p.code, p.name, COUNT(s.id) as c
       FROM subscription_plans p
       LEFT JOIN organization_subscriptions s ON s.plan_id = p.id
       GROUP BY p.id
       ORDER BY p.sort_order`,
    ).all<{ code: string; name: string; c: number }>(),
  ]);

  return c.json({
    stats: {
      activeOrganizations: orgs?.c ?? 0,
      totalUsers: users?.c ?? 0,
      subscriptionsByStatus: subs.results ?? [],
      subscriptionsByPlan: plans.results ?? [],
    },
  });
});

adminRoutes.get("/plans", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const plans = await listPlans(c.env.DB, false);
  return c.json({ plans });
});

adminRoutes.get("/organizations", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const q = c.req.query("q")?.trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  let query = `
    SELECT o.id, o.name, o.slug, o.status, o.created_at,
           p.code as plan_code, p.name as plan_name,
           s.status as subscription_status,
           (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id AND m.status = 'active') as member_count
    FROM organizations o
    LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
    LEFT JOIN subscription_plans p ON p.id = s.plan_id
  `;
  const binds: unknown[] = [];

  if (q) {
    query += " WHERE o.name LIKE ? OR o.slug LIKE ?";
    binds.push(`%${q}%`, `%${q}%`);
  }
  query += " ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...binds).all();

  return c.json({ organizations: results ?? [], limit, offset });
});

adminRoutes.post("/organizations", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const body = await c.req.json<{ name?: string; slug?: string; ownerEmail?: string; ownerUserId?: string }>();
  if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
  if (!body.ownerEmail?.trim() && !body.ownerUserId?.trim()) {
    return c.json({ error: "ownerEmail or ownerUserId required" }, 400);
  }

  const owner = body.ownerUserId
    ? await c.env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?")
        .bind(body.ownerUserId.trim())
        .first<{ id: string; email: string | null; name: string }>()
    : await c.env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?")
        .bind(body.ownerEmail!.trim().toLowerCase())
        .first<{ id: string; email: string | null; name: string }>();

  if (!owner) return c.json({ error: "Owner user not found" }, 404);

  const activeOrg = await c.env.DB.prepare(
    "SELECT organization_id FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1",
  )
    .bind(owner.id)
    .first<{ organization_id: string }>();
  if (activeOrg) {
    return c.json({ error: "Owner already belongs to an organization", code: "ONE_ORG_POLICY" }, 409);
  }

  let slug = body.slug?.trim().toLowerCase() || body.name.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  if (!slug) slug = `org-${Date.now().toString(36)}`;
  const existing = await c.env.DB.prepare("SELECT id FROM organizations WHERE slug = ?").bind(slug).first();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const org = await createOrganizationForOwner(c.env.DB, owner.id, body.name.trim(), slug);
  await writeAuditLog(c.env.DB, org.id, user.id, "admin.org_created", "organization", org.id, {
    ownerUserId: owner.id,
    ownerEmail: owner.email,
  });

  return c.json({ organization: org, owner }, 201);
});

adminRoutes.get("/organizations/:orgId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const org = await c.env.DB.prepare(
    `SELECT o.id, o.name, o.slug, o.status, o.owner_id, o.timezone, o.created_at,
            ou.name as owner_name, ou.email as owner_email
     FROM organizations o
     LEFT JOIN users ou ON ou.id = o.owner_id
     WHERE o.id = ?`,
  )
    .bind(orgId)
    .first();

  if (!org) return c.json({ error: "Not found" }, 404);

  const subscription = await getOrgSubscription(c.env.DB, orgId);
  const { results: members } = await c.env.DB.prepare(
    `SELECT m.user_id, m.role, m.status, m.joined_at, u.name, u.email
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ?
     ORDER BY m.role, u.name`,
  )
    .bind(orgId)
    .all();

  return c.json({ organization: org, subscription, members: members ?? [] });
});

adminRoutes.patch("/organizations/:orgId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const body = await c.req.json<{
    status?: string;
    planId?: string;
    subscriptionStatus?: string;
    name?: string;
    timezone?: string;
  }>();

  const org = await c.env.DB.prepare("SELECT id FROM organizations WHERE id = ?").bind(orgId).first();
  if (!org) return c.json({ error: "Not found" }, 404);

  if (body.name?.trim()) {
    await c.env.DB.prepare("UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?")
      .bind(body.name.trim(), now(), orgId)
      .run();
  }

  if (body.timezone) {
    await c.env.DB.prepare("UPDATE organizations SET timezone = ?, updated_at = ? WHERE id = ?")
      .bind(body.timezone, now(), orgId)
      .run();
  }

  if (body.status) {
    await c.env.DB.prepare("UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?")
      .bind(body.status, now(), orgId)
      .run();
  }

  if (body.planId) {
    const plan = await c.env.DB.prepare("SELECT id FROM subscription_plans WHERE id = ?")
      .bind(body.planId)
      .first();
    if (!plan) return c.json({ error: "Invalid plan" }, 400);
    const allowedStatuses = ["active", "trialing", "past_due", "canceled", "suspended"] as const;
    const nextStatus = allowedStatuses.includes(body.subscriptionStatus as (typeof allowedStatuses)[number])
      ? (body.subscriptionStatus as (typeof allowedStatuses)[number])
      : "active";
    await assignOrgPlan(c.env.DB, orgId, body.planId, nextStatus);
  } else if (body.subscriptionStatus) {
    const allowedStatuses = ["active", "trialing", "past_due", "canceled", "suspended"] as const;
    if (!allowedStatuses.includes(body.subscriptionStatus as (typeof allowedStatuses)[number])) {
      return c.json({ error: "Invalid subscription status" }, 400);
    }
    await c.env.DB.prepare("UPDATE organization_subscriptions SET status = ?, updated_at = ? WHERE organization_id = ?")
      .bind(body.subscriptionStatus, now(), orgId)
      .run();
  }

  await writeAuditLog(c.env.DB, orgId, user.id, "admin.org_updated", "organization", orgId, body);

  const subscription = await getOrgSubscription(c.env.DB, orgId);
  return c.json({ ok: true, subscription });
});

adminRoutes.patch("/organizations/:orgId/members/:userId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const targetUserId = c.req.param("userId");
  const body = await c.req.json<{ role?: string; status?: string; name?: string }>();

  const target = await c.env.DB.prepare(
    "SELECT role, status FROM memberships WHERE organization_id = ? AND user_id = ?",
  )
    .bind(orgId, targetUserId)
    .first<{ role: string; status: string }>();
  if (!target) return c.json({ error: "Member not found" }, 404);

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
  if (body.name?.trim()) {
    await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
      .bind(body.name.trim(), now(), targetUserId)
      .run();
  }

  if (updates.length) {
    values.push(orgId, targetUserId);
    await c.env.DB.prepare(`UPDATE memberships SET ${updates.join(", ")} WHERE organization_id = ? AND user_id = ?`)
      .bind(...values)
      .run();
  }

  if (!updates.length && !body.name?.trim()) return c.json({ error: "Nothing to update" }, 400);

  await writeAuditLog(c.env.DB, orgId, user.id, "admin.member_updated", "membership", targetUserId, body);
  return c.json({ ok: true });
});

adminRoutes.delete("/organizations/:orgId/members/:userId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const targetUserId = c.req.param("userId");
  const owner = await c.env.DB.prepare("SELECT owner_id FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ owner_id: string }>();
  if (!owner) return c.json({ error: "Organization not found" }, 404);
  if (owner.owner_id === targetUserId) return c.json({ error: "Cannot remove current owner" }, 400);

  await c.env.DB.prepare("DELETE FROM memberships WHERE organization_id = ? AND user_id = ?")
    .bind(orgId, targetUserId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "admin.member_removed", "membership", targetUserId);
  return c.json({ ok: true });
});

adminRoutes.patch("/organizations/:orgId/owner", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const body = await c.req.json<{ newOwnerUserId?: string }>();
  if (!body.newOwnerUserId) return c.json({ error: "newOwnerUserId required" }, 400);

  const newOwner = await c.env.DB.prepare(
    "SELECT user_id FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(orgId, body.newOwnerUserId)
    .first<{ user_id: string }>();
  if (!newOwner) return c.json({ error: "New owner must be an active member" }, 400);

  const prev = await c.env.DB.prepare("SELECT owner_id FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ owner_id: string }>();
  if (!prev) return c.json({ error: "Organization not found" }, 404);

  await c.env.DB.prepare("UPDATE organizations SET owner_id = ?, updated_at = ? WHERE id = ?")
    .bind(body.newOwnerUserId, now(), orgId)
    .run();
  await c.env.DB.prepare(
    "UPDATE memberships SET role = CASE WHEN user_id = ? THEN 'owner' WHEN user_id = ? AND role = 'owner' THEN 'admin' ELSE role END WHERE organization_id = ?",
  )
    .bind(body.newOwnerUserId, prev.owner_id, orgId)
    .run();

  await writeAuditLog(c.env.DB, orgId, user.id, "admin.owner_transferred", "organization", orgId, {
    previousOwnerUserId: prev.owner_id,
    newOwnerUserId: body.newOwnerUserId,
  });
  return c.json({ ok: true });
});

adminRoutes.get("/users", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const q = c.req.query("q")?.trim();
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  let query = `
    SELECT u.id, u.email, u.name, u.email_verified, u.created_at,
           CASE WHEN pa.user_id IS NOT NULL THEN 1 ELSE 0 END as is_platform_admin,
           pa.role as platform_role,
           (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id AND m.status = 'active') as org_count
    FROM users u
    LEFT JOIN platform_admins pa ON pa.user_id = u.id
  `;
  const binds: unknown[] = [];

  if (q) {
    query += " WHERE u.email LIKE ? OR u.name LIKE ?";
    binds.push(`%${q}%`, `%${q}%`);
  }
  query += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json({ users: results ?? [], limit, offset });
});

adminRoutes.patch("/users/:userId/platform-admin", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;
  if (admin.role !== "super_admin") return c.json({ error: "Super admin required" }, 403);

  const targetId = c.req.param("userId");
  const body = await c.req.json<{ grant: boolean; role?: string }>();

  const target = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(targetId).first();
  if (!target) return c.json({ error: "User not found" }, 404);

  if (body.grant) {
    const role = body.role ?? "support";
    await c.env.DB.prepare(
      `INSERT INTO platform_admins (user_id, role, granted_at, granted_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, granted_at = excluded.granted_at, granted_by = excluded.granted_by`,
    )
      .bind(targetId, role, now(), user.id)
      .run();
  } else {
    if (targetId === user.id) return c.json({ error: "Cannot revoke own admin access" }, 400);
    await c.env.DB.prepare("DELETE FROM platform_admins WHERE user_id = ?").bind(targetId).run();
  }

  return c.json({ ok: true });
});

export async function extendAuthMe(db: D1Database, userId: string) {
  const isAdmin = await isPlatformAdmin(db, userId);
  const platformRole = await getPlatformAdminRole(db, userId);
  return { isPlatformAdmin: isAdmin, platformRole };
}
