import type { OrgRole } from "./permissions";

export type ProjectMemberRole = "owner" | "manager" | "member" | "viewer";

const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ["owner", "manager", "member", "viewer"];

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

/** 프로젝트 내 사용자 역할. 접근 불가 시 null. 조직 owner/admin은 owner 권한으로 취급 */
export async function getProjectMemberRole(
  db: D1Database,
  userId: string,
  orgRole: OrgRole | string,
  projectId: string,
  orgId: string,
): Promise<ProjectMemberRole | null> {
  const hasAccess = await assertProjectAccess(db, userId, orgRole, projectId, orgId);
  if (!hasAccess) return null;

  if (orgRoleSeesAllProjects(orgRole)) return "owner";

  const project = await db
    .prepare("SELECT owner_id FROM projects WHERE id = ? AND organization_id = ?")
    .bind(projectId, orgId)
    .first<{ owner_id: string }>();
  if (!project) return null;

  if (project.owner_id === userId) return "owner";

  const row = await db
    .prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
    .bind(projectId, userId)
    .first<{ role: string }>();

  if (!row) return null;
  if (PROJECT_MEMBER_ROLES.includes(row.role as ProjectMemberRole)) {
    return row.role as ProjectMemberRole;
  }
  return "member";
}

export function canProjectWriteContent(role: ProjectMemberRole | null): boolean {
  return role === "owner" || role === "manager" || role === "member";
}

export function canProjectEditMeta(role: ProjectMemberRole | null): boolean {
  return role === "owner" || role === "manager";
}

export function canProjectManageMembers(role: ProjectMemberRole | null): boolean {
  return role === "owner" || role === "manager";
}

export async function canDeleteProject(
  db: D1Database,
  userId: string,
  orgRole: OrgRole | string,
  projectId: string,
): Promise<boolean> {
  if (orgRoleSeesAllProjects(orgRole)) return true;

  const project = await db
    .prepare("SELECT owner_id FROM projects WHERE id = ?")
    .bind(projectId)
    .first<{ owner_id: string }>();

  return project?.owner_id === userId;
}
