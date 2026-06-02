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
  getOrgSubscription,
  listPlans,
  writeAuditLog,
} from "../utils/subscriptions";
import { newId, now } from "../utils/helpers";

export const adminRoutes = new Hono<{ Bindings: Env }>();

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

adminRoutes.get("/organizations/:orgId", async (c) => {
  const user = await requireAuth(c);
  if (user instanceof Response) return user;
  const admin = await requirePlatformAdmin(c, user.id);
  if (admin instanceof Response) return admin;

  const orgId = c.req.param("orgId");
  const org = await c.env.DB.prepare(
    "SELECT id, name, slug, status, owner_id, timezone, created_at FROM organizations WHERE id = ?",
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
  const body = await c.req.json<{ status?: string; planId?: string; subscriptionStatus?: string }>();

  const org = await c.env.DB.prepare("SELECT id FROM organizations WHERE id = ?").bind(orgId).first();
  if (!org) return c.json({ error: "Not found" }, 404);

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
    await assignOrgPlan(
      c.env.DB,
      orgId,
      body.planId,
      (body.subscriptionStatus as "active" | "trialing" | "suspended") ?? "active",
    );
  }

  await writeAuditLog(c.env.DB, orgId, user.id, "admin.org_updated", "organization", orgId, body);

  const subscription = await getOrgSubscription(c.env.DB, orgId);
  return c.json({ ok: true, subscription });
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
