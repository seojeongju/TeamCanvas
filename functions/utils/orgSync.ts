import type { Env } from "../types";

export type OrgSyncScope =
  | "tasks"
  | "projects"
  | "events"
  | "notifications"
  | "activity"
  | "files";

export async function bumpOrgSync(
  db: D1Database,
  orgId: string,
  _scopes?: OrgSyncScope[],
): Promise<void> {
  const ts = Date.now();
  await db
    .prepare(
      `INSERT INTO org_sync_state (organization_id, version, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(organization_id) DO UPDATE SET
         version = org_sync_state.version + 1,
         updated_at = excluded.updated_at`,
    )
    .bind(orgId, ts)
    .run();
}

export async function getOrgSyncVersion(
  db: D1Database,
  orgId: string,
): Promise<{ version: number; updatedAt: number }> {
  const row = await db
    .prepare("SELECT version, updated_at FROM org_sync_state WHERE organization_id = ?")
    .bind(orgId)
    .first<{ version: number; updated_at: number }>();

  return {
    version: row?.version ?? 0,
    updatedAt: row?.updated_at ?? 0,
  };
}

export async function bumpOrgSyncSafe(env: Env, orgId: string, scopes?: OrgSyncScope[]) {
  try {
    await bumpOrgSync(env.DB, orgId, scopes);
  } catch {
    // org_sync_state may not exist before migration
  }
}
