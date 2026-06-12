import { newId, now } from "./helpers";

/** 팀 지정 시 팀원을 프로젝트 멤버(member)로 자동 추가 (소유자·기존 멤버 역할 유지) */
export async function syncProjectTeamMembers(
  db: D1Database,
  opts: {
    projectId: string;
    orgId: string;
    teamId: string | null | undefined;
    actorId: string;
  },
): Promise<number> {
  const { projectId, orgId, teamId, actorId } = opts;
  if (!teamId) return 0;

  const owner = await db
    .prepare("SELECT owner_id FROM projects WHERE id = ?")
    .bind(projectId)
    .first<{ owner_id: string }>();
  if (!owner) return 0;

  const { results: teamRows } = await db
    .prepare(
      `SELECT tm.user_id
       FROM team_members tm
       JOIN memberships m ON m.user_id = tm.user_id AND m.organization_id = ? AND m.status = 'active'
       WHERE tm.team_id = ?`,
    )
    .bind(orgId, teamId)
    .all();

  const ts = now();
  let added = 0;

  for (const row of teamRows ?? []) {
    const userId = (row as { user_id: string }).user_id;
    if (userId === owner.owner_id || userId === actorId) continue;

    const existing = await db
      .prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(projectId, userId)
      .first<{ role: string }>();
    if (existing) continue;

    await db
      .prepare(
        `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
      )
      .bind(projectId, userId, ts)
      .run();
    added++;
  }

  return added;
}
