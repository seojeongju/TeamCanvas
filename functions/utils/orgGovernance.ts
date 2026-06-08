import type { Permission } from "./permissions";
import type { OrgRole } from "./permissions";

export const WRITE_PERMISSIONS = new Set<Permission>([
  "org:settings",
  "members:manage",
  "teams:manage",
  "teams:members",
  "events:write",
  "events:delete",
  "tasks:write",
  "tasks:delete",
  "billing:manage",
]);

export function isWritePermission(permission: Permission): boolean {
  return WRITE_PERMISSIONS.has(permission);
}

export type CalendarPolicy = "own_teams" | "all_teams";

export function canUseAllTeamsCalendarPolicy(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** team visibility SQL fragment for events list */
export function teamVisibilitySql(calendarPolicy: CalendarPolicy, role: OrgRole): string {
  if (calendarPolicy === "all_teams" && canUseAllTeamsCalendarPolicy(role)) {
    return `(e.visibility = 'team' AND e.team_id IS NOT NULL)`;
  }
  return `(
           e.visibility = 'team' AND e.team_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM team_members tm
             WHERE tm.team_id = e.team_id AND tm.user_id = ?
           )
         )`;
}
