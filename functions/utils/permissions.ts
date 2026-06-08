import type { Context } from "hono";
import type { Env } from "../types";

export const ORG_ROLES = ["owner", "admin", "member", "guest"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const PLATFORM_ADMIN_ROLES = ["super_admin", "support", "billing"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export type Permission =
  | "org:read"
  | "org:settings"
  | "members:read"
  | "members:manage"
  | "teams:read"
  | "teams:manage"
  | "teams:members"
  | "events:read"
  | "events:write"
  | "events:delete"
  | "tasks:read"
  | "tasks:write"
  | "tasks:delete"
  | "billing:read"
  | "billing:manage";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: [
    "org:read",
    "org:settings",
    "members:read",
    "members:manage",
    "teams:read",
    "teams:manage",
    "teams:members",
    "events:read",
    "events:write",
    "events:delete",
    "tasks:read",
    "tasks:write",
    "tasks:delete",
    "billing:read",
    "billing:manage",
  ],
  admin: [
    "org:read",
    "org:settings",
    "members:read",
    "members:manage",
    "teams:read",
    "teams:manage",
    "teams:members",
    "events:read",
    "events:write",
    "events:delete",
    "tasks:read",
    "tasks:write",
    "tasks:delete",
    "billing:read",
  ],
  member: [
    "org:read",
    "members:read",
    "teams:read",
    "events:read",
    "events:write",
    "events:delete",
    "tasks:read",
    "tasks:write",
  ],
  guest: ["org:read", "events:read", "tasks:read"],
};

export function isOrgRole(role: string): role is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(role);
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  if (!isOrgRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: string): Permission[] {
  if (!isOrgRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}

export async function requireOrgPermission(
  c: Context<{ Bindings: Env }>,
  userId: string,
  orgId: string,
  permission: Permission,
): Promise<{ role: OrgRole } | Response> {
  const membership = await c.env.DB.prepare(
    "SELECT role FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(orgId, userId)
    .first<{ role: string }>();

  if (!membership) return c.json({ error: "Forbidden" }, 403);

  const org = await c.env.DB.prepare("SELECT status FROM organizations WHERE id = ?")
    .bind(orgId)
    .first<{ status: string }>();

  if (!org || org.status === "suspended") {
    return c.json({ error: "Organization suspended" }, 403);
  }

  if (!roleHasPermission(membership.role, permission)) {
    return c.json({ error: "Insufficient permissions" }, 403);
  }

  return { role: membership.role as OrgRole };
}

export async function isPlatformAdmin(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT user_id FROM platform_admins WHERE user_id = ?")
    .bind(userId)
    .first();
  return Boolean(row);
}

export async function getPlatformAdminRole(
  db: D1Database,
  userId: string,
): Promise<PlatformAdminRole | null> {
  const row = await db
    .prepare("SELECT role FROM platform_admins WHERE user_id = ?")
    .bind(userId)
    .first<{ role: string }>();
  if (!row || !(PLATFORM_ADMIN_ROLES as readonly string[]).includes(row.role)) return null;
  return row.role as PlatformAdminRole;
}

export async function requirePlatformAdmin(
  c: Context<{ Bindings: Env }>,
  userId: string,
): Promise<{ role: PlatformAdminRole } | Response> {
  const role = await getPlatformAdminRole(c.env.DB, userId);
  if (!role) return c.json({ error: "Platform admin required" }, 403);
  return { role };
}

export async function countPlatformAdmins(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) as c FROM platform_admins").first<{ c: number }>();
  return row?.c ?? 0;
}
