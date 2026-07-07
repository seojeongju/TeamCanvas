import type { Env } from "../types";
import { isAutomationPresetEnabled } from "./automationPresets";
import { createNotification, taskDetailLink } from "./notifications";
import { now } from "./helpers";

function startOfDayKst(ts: number): number {
  const d = new Date(ts + 9 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - 9 * 60 * 60 * 1000;
}

/** Cron — 지연 업무 일일 알림 (preset: notify_task_overdue_daily) */
export async function processOverdueTaskReminders(db: D1Database, env: Env): Promise<number> {
  const ts = now();
  const todayStart = startOfDayKst(ts);
  let sent = 0;

  const { results: orgRows } = await db
    .prepare("SELECT id FROM organizations WHERE deactivated_at IS NULL")
    .all();

  for (const orgRow of orgRows ?? []) {
    const orgId = (orgRow as { id: string }).id;
    const enabled = await isAutomationPresetEnabled(db, orgId, "notify_task_overdue_daily");
    if (!enabled) continue;

    const { results } = await db
      .prepare(
        `SELECT id, title, assignee_id, due_at, overdue_notified_at
         FROM tasks
         WHERE organization_id = ?
           AND parent_task_id IS NULL
           AND status != 'done'
           AND due_at IS NOT NULL
           AND due_at < ?
           AND assignee_id IS NOT NULL
           AND (overdue_notified_at IS NULL OR overdue_notified_at < ?)`,
      )
      .bind(orgId, ts, todayStart)
      .all();

    for (const row of results ?? []) {
      const r = row as {
        id: string;
        title: string;
        assignee_id: string;
        due_at: number;
      };

      await createNotification(db, env, {
        userId: r.assignee_id,
        organizationId: orgId,
        type: "task_overdue",
        title: "지연 업무",
        body: `「${r.title}」 마감이 지났습니다.`,
        link: taskDetailLink(r.id),
      });

      await db
        .prepare("UPDATE tasks SET overdue_notified_at = ? WHERE id = ?")
        .bind(ts, r.id)
        .run();

      sent += 1;
    }
  }

  return sent;
}
