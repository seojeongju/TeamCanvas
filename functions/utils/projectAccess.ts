import type { OrgRole } from "./permissions";

export function orgRoleSeesAllProjects(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** member/guest: 소유자이거나 project_members에 포함된 프로젝트만 */
export const PROJECT_MEMBER_ACCESS_SQL = `
  AND (
    p.owner_id = ?
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = p.id AND pm.user_id = ?
    )
  )
`;

export async function assertProjectAccess(
  db: D1Database,
  userId: string,
  orgRole: OrgRole | string,
  projectId: string,
  orgId: string,
): Promise<boolean> {
  if (orgRoleSeesAllProjects(orgRole)) return true;

  const row = await db
    .prepare(
      `SELECT 1 FROM projects p
       WHERE p.id = ? AND p.organization_id = ?
       AND (
         p.owner_id = ?
         OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = p.id AND pm.user_id = ?
         )
       )`,
    )
    .bind(projectId, orgId, userId, userId)
    .first();

  return !!row;
}
