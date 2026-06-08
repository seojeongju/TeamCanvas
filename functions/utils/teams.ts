import type { Context } from "hono";
import type { Env } from "../types";
import { requireOrgPermission, type OrgRole } from "./permissions";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isValidTeamColor(color: string): boolean {
  return HEX_COLOR.test(color);
}

export async function getTeamInOrg(
  db: D1Database,
  orgId: string,
  teamId: string,
): Promise<{
  id: string;
  name: string;
  color: string;
  description: string | null;
  department_id: string | null;
} | null> {
  return db
    .prepare("SELECT id, name, color, description, department_id FROM teams WHERE id = ? AND organization_id = ?")
    .bind(teamId, orgId)
    .first<{
      id: string;
      name: string;
      color: string;
      description: string | null;
      department_id: string | null;
    }>();
}

export async function isTeamLead(db: D1Database, teamId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(teamId, userId)
    .first<{ role: string }>();
  return row?.role === "lead";
}

export async function isTeamMember(db: D1Database, teamId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(teamId, userId)
    .first();
  return Boolean(row);
}

export async function isActiveOrgMember(
  db: D1Database,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'")
    .bind(orgId, userId)
    .first();
  return Boolean(row);
}

/** teams:manage 또는 해당 팀 리드 */
export async function requireTeamMembersAccess(
  c: Context<{ Bindings: Env }>,
  userId: string,
  orgId: string,
  teamId: string,
): Promise<{ role: OrgRole; canManageTeam: boolean } | Response> {
  const membership = await requireOrgPermission(c, userId, orgId, "teams:read");
  if (membership instanceof Response) return membership;

  const canManageOrg = membership.role === "owner" || membership.role === "admin";
  if (canManageOrg) return { role: membership.role, canManageTeam: true };

  const lead = await isTeamLead(c.env.DB, teamId, userId);
  if (lead) return { role: membership.role, canManageTeam: true };

  return c.json({ error: "Insufficient permissions" }, 403);
}

export async function addUserToDefaultTeam(db: D1Database, orgId: string, userId: string): Promise<void> {
  const team = await db
    .prepare("SELECT id FROM teams WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1")
    .bind(orgId)
    .first<{ id: string }>();
  if (!team) return;

  const existing = await db
    .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(team.id, userId)
    .first();
  if (existing) return;

  await db
    .prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')")
    .bind(team.id, userId)
    .run();
}
