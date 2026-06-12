import type { Env } from "../types";
import { formatDateOnlyKst, now } from "./helpers";
import { notifyMilestoneDue } from "./notifications";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Cron·API 공통 — 마감 1일 전(또는 당일) 마일스톤 인앱 알림 */
export async function processMilestoneDueReminders(
  db: D1Database,
  env: Env | undefined,
): Promise<number> {
  const ts = now();
  let processed = 0;

  let results: Record<string, unknown>[] = [];
  try {
    const query = await db
      .prepare(
        `SELECT m.id, m.title, m.due_at, m.project_id, p.name as project_name, p.organization_id
         FROM project_milestones m
         JOIN projects p ON p.id = m.project_id
         WHERE m.status = 'pending'
           AND m.due_at IS NOT NULL
           AND m.due_reminder_sent_at IS NULL
           AND m.due_at <= ?
           AND m.due_at > ?`,
      )
      .bind(ts + ONE_DAY_MS, ts - ONE_DAY_MS * 7)
      .all<Record<string, unknown>>();
    results = query.results ?? [];
  } catch {
    return 0;
  }

  for (const row of results) {
    try {
      const projectId = row.project_id as string;
      const { results: members } = await db
        .prepare(
          `SELECT DISTINCT user_id FROM (
             SELECT user_id FROM project_members WHERE project_id = ?
             UNION
             SELECT owner_id AS user_id FROM projects WHERE id = ?
           )`,
        )
        .bind(projectId, projectId)
        .all<{ user_id: string }>();

      for (const member of members ?? []) {
        await notifyMilestoneDue(db, env, {
          userId: member.user_id,
          organizationId: row.organization_id as string,
          projectId,
          projectName: row.project_name as string,
          milestoneTitle: row.title as string,
          dueAt: row.due_at as number,
        });
      }

      await db
        .prepare("UPDATE project_milestones SET due_reminder_sent_at = ? WHERE id = ?")
        .bind(ts, row.id as string)
        .run();
      processed++;
    } catch {
      /* 개별 실패는 건너뜀 */
    }
  }

  return processed;
}

export function milestoneDueReminderBody(projectName: string, title: string, dueAt: number): string {
  return `${projectName} · ${title} (${formatDateOnlyKst(dueAt)} 마감)`;
}
