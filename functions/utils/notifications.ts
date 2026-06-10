import type { Env } from "../types";
import { newId, now } from "./helpers";
import { sendNotificationEmail } from "./email";
import { sendPushToUser } from "./push";

export async function createNotification(
  db: D1Database,
  env: Env | undefined,
  data: {
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
  },
) {
  if (!data.userId) return;

  const pref = await db
    .prepare(
      "SELECT in_app_enabled, push_enabled, email_enabled FROM notification_preferences WHERE user_id = ?",
    )
    .bind(data.userId)
    .first<{ in_app_enabled: number; push_enabled: number; email_enabled: number }>();

  const inAppEnabled = pref ? Boolean(pref.in_app_enabled) : true;

  if (inAppEnabled) {
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, organization_id, type, title, body, link, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        data.userId,
        data.organizationId,
        data.type,
        data.title,
        data.body ?? null,
        data.link ?? null,
        now(),
      )
      .run();
  }

  if (env && pref && Boolean(pref.push_enabled)) {
    await sendPushToUser(db, env, data.userId, {
      title: data.title,
      body: data.body ?? undefined,
      link: data.link ?? undefined,
    });
  }

  if (env) {

    const emailEnabled = pref ? Boolean(pref.email_enabled) : false;
    if (emailEnabled) {
      const user = await db
        .prepare("SELECT email, name FROM users WHERE id = ?")
        .bind(data.userId)
        .first<{ email: string | null; name: string }>();
      if (user?.email) {
        const emailBody = data.body ? `${user.name}님, ${data.body}` : `${user.name}님, 새 알림이 있습니다.`;
        await sendNotificationEmail(env, user.email, data.title, emailBody, data.link);
      }
    }
  }
}

export async function notifyTaskAssigned(
  db: D1Database,
  env: Env | undefined,
  opts: {
    assigneeId: string;
    actorId: string;
    organizationId: string;
    taskId: string;
    taskTitle: string;
  },
) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.assigneeId,
    organizationId: opts.organizationId,
    type: "task_assigned",
    title: "업무가 배정되었습니다",
    body: opts.taskTitle,
    link: `/tasks?task=${opts.taskId}`,
  });
}

export async function notifyTaskDueSoon(
  db: D1Database,
  env: Env | undefined,
  opts: {
    assigneeId: string;
    organizationId: string;
    taskId: string;
    taskTitle: string;
    dueAt: number;
  },
) {
  if (!opts.assigneeId) return;
  const dueLabel = new Date(opts.dueAt).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
  await createNotification(db, env, {
    userId: opts.assigneeId,
    organizationId: opts.organizationId,
    type: "task_due_soon",
    title: "업무 마감이 임박했습니다",
    body: `${opts.taskTitle} · ${dueLabel}`,
    link: `/tasks?task=${opts.taskId}`,
  });
}

export async function notifyTaskComment(
  db: D1Database,
  env: Env | undefined,
  opts: {
    recipientId: string;
    actorId: string;
    organizationId: string;
    taskId: string;
    taskTitle: string;
    preview: string;
  },
) {
  if (!opts.recipientId || opts.recipientId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.recipientId,
    organizationId: opts.organizationId,
    type: "task_comment",
    title: "업무에 댓글이 달렸습니다",
    body: `${opts.taskTitle}: ${opts.preview}`,
    link: `/tasks?task=${opts.taskId}`,
  });
}

export async function notifyTaskMention(
  db: D1Database,
  env: Env | undefined,
  opts: {
    mentionedUserId: string;
    actorId: string;
    organizationId: string;
    taskId: string;
    taskTitle: string;
    preview: string;
  },
) {
  if (!opts.mentionedUserId || opts.mentionedUserId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.mentionedUserId,
    organizationId: opts.organizationId,
    type: "task_mention",
    title: "댓글에서 멘션되었습니다",
    body: `${opts.taskTitle}: ${opts.preview}`,
    link: `/tasks?task=${opts.taskId}`,
  });
}

export async function notifyEventComment(
  db: D1Database,
  env: Env | undefined,
  opts: {
    recipientId: string;
    actorId: string;
    actorName: string;
    organizationId: string;
    eventId: string;
    eventTitle: string;
    preview: string;
  },
) {
  if (!opts.recipientId || opts.recipientId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.recipientId,
    organizationId: opts.organizationId,
    type: "event_comment",
    title: "일정에 댓글이 달렸습니다",
    body: `${opts.actorName}님이 「${opts.eventTitle}」: ${opts.preview}`,
    link: `/calendar?event=${opts.eventId}`,
  });
}

export async function notifyEventMention(
  db: D1Database,
  env: Env | undefined,
  opts: {
    mentionedUserId: string;
    actorId: string;
    actorName: string;
    organizationId: string;
    eventId: string;
    eventTitle: string;
    preview: string;
  },
) {
  if (!opts.mentionedUserId || opts.mentionedUserId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.mentionedUserId,
    organizationId: opts.organizationId,
    type: "event_mention",
    title: "일정 댓글에서 멘션되었습니다",
    body: `${opts.actorName}님이 「${opts.eventTitle}」에서 멘션: ${opts.preview}`,
    link: `/calendar?event=${opts.eventId}`,
  });
}
