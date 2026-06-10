import type { Env } from "../types";
import { newId, now } from "./helpers";
import { notifyEventReminder } from "./notifications";
import { recurrenceOccurrenceStarts } from "./recurrence";

const REMINDER_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

export async function insertEventReminders(
  db: D1Database,
  opts: {
    eventId: string;
    organizationId: string;
    startAt: number;
    recurrenceRule?: string | null;
    excludedDates?: string[];
    reminderMinutes: number[];
    targetUserIds: string[];
    createdAt?: number;
  },
): Promise<void> {
  const ts = opts.createdAt ?? now();
  const horizonEnd = ts + REMINDER_HORIZON_MS;
  const occurrenceStarts = recurrenceOccurrenceStarts(
    opts.startAt,
    opts.recurrenceRule,
    opts.excludedDates,
    ts,
    horizonEnd,
  );

  for (const targetUserId of opts.targetUserIds) {
    for (const occStart of occurrenceStarts) {
      for (const minutes of opts.reminderMinutes) {
        const remindAt = occStart - minutes * 60 * 1000;
        if (remindAt <= ts) continue;
        await db
          .prepare(
            `INSERT INTO event_reminders (id, event_id, organization_id, user_id, reminder_minutes, remind_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(newId(), opts.eventId, opts.organizationId, targetUserId, minutes, remindAt, ts)
          .run();
      }
    }
  }
}

/** Cron·API 공통 — 기한 도래 리마인더 인앱 알림 + 푸시 */
export async function processDueReminders(db: D1Database, env: Env | undefined): Promise<number> {
  const ts = now();
  let processed = 0;

  const { results } = await db
    .prepare(
      `SELECT r.id, r.event_id, r.organization_id, r.user_id, r.reminder_minutes, r.remind_at, e.title, e.start_at
       FROM event_reminders r
       JOIN events e ON e.id = r.event_id
       WHERE r.remind_at <= ?
         AND r.delivered_at IS NULL
         AND r.notified_at IS NULL
       ORDER BY r.remind_at ASC
       LIMIT 200`,
    )
    .bind(ts)
    .all<Record<string, unknown>>();

  for (const row of results ?? []) {
    try {
      const reminderMinutes = row.reminder_minutes as number;
      const remindAt = row.remind_at as number;
      await notifyEventReminder(db, env, {
        userId: row.user_id as string,
        organizationId: row.organization_id as string,
        eventId: row.event_id as string,
        eventTitle: row.title as string,
        reminderMinutes,
        startAt: remindAt + reminderMinutes * 60 * 1000,
      });
      await db
        .prepare("UPDATE event_reminders SET notified_at = ? WHERE id = ?")
        .bind(ts, row.id as string)
        .run();
      processed++;
    } catch {
      /* 개별 실패는 건너뜀 */
    }
  }

  return processed;
}
