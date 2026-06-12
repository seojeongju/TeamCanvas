import type { Env } from "../types";
import { formatDateKst, formatDateOnlyKst, formatEventDateTimeKst, newId, now } from "./helpers";
import { sendNotificationEmail } from "./email";
import { sendPushToUser } from "./push";

export function eventDetailLink(eventId: string): string {
  return `/calendar?event=${encodeURIComponent(eventId)}`;
}

export function taskDetailLink(taskId: string): string {
  return `/tasks?task=${encodeURIComponent(taskId)}`;
}

export function projectMilestonesLink(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}?tab=milestones`;
}

export function projectDetailLink(projectId: string, tab?: string): string {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

async function notifyProjectMemberIds(
  db: D1Database,
  env: Env | undefined,
  opts: {
    userIds: string[];
    actorId: string;
    organizationId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  },
) {
  const sent = new Set<string>();
  for (const userId of opts.userIds) {
    if (!userId || userId === opts.actorId || sent.has(userId)) continue;
    sent.add(userId);
    await createNotification(db, env, {
      userId,
      organizationId: opts.organizationId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link,
    });
  }
}

export async function notifyProjectMembers(
  db: D1Database,
  env: Env | undefined,
  opts: {
    projectId: string;
    actorId: string;
    organizationId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  },
) {
  const { results } = await db
    .prepare(
      `SELECT user_id FROM project_members WHERE project_id = ?
       UNION
       SELECT owner_id AS user_id FROM projects WHERE id = ?`,
    )
    .bind(opts.projectId, opts.projectId)
    .all();

  const userIds = (results ?? []).map((r) => (r as { user_id: string }).user_id);
  await notifyProjectMemberIds(db, env, { ...opts, userIds });
}

export async function notifyProjectComment(
  db: D1Database,
  env: Env | undefined,
  opts: {
    projectId: string;
    projectName: string;
    actorId: string;
    organizationId: string;
    preview: string;
    mentionedIds?: string[];
  },
) {
  const link = projectDetailLink(opts.projectId);
  const body = `${opts.projectName}: ${opts.preview}`;

  if (opts.mentionedIds?.length) {
    await notifyProjectMemberIds(db, env, {
      userIds: opts.mentionedIds,
      actorId: opts.actorId,
      organizationId: opts.organizationId,
      type: "project_mention",
      title: "프로젝트 댓글에서 멘션되었습니다",
      body,
      link,
    });
  }

  const { results } = await db
    .prepare(
      `SELECT user_id FROM project_members WHERE project_id = ?
       UNION SELECT owner_id AS user_id FROM projects WHERE id = ?`,
    )
    .bind(opts.projectId, opts.projectId)
    .all();

  const mentioned = new Set(opts.mentionedIds ?? []);
  const recipients = (results ?? [])
    .map((r) => (r as { user_id: string }).user_id)
    .filter((id) => id !== opts.actorId && !mentioned.has(id));

  await notifyProjectMemberIds(db, env, {
    userIds: recipients,
    actorId: opts.actorId,
    organizationId: opts.organizationId,
    type: "project_comment",
    title: "프로젝트에 댓글이 달렸습니다",
    body,
    link,
  });
}

export async function notifyProjectMemberAdded(
  db: D1Database,
  env: Env | undefined,
  opts: {
    userId: string;
    actorId: string;
    organizationId: string;
    projectId: string;
    projectName: string;
    actorName: string;
  },
) {
  if (!opts.userId || opts.userId === opts.actorId) return;
  await createNotification(db, env, {
    userId: opts.userId,
    organizationId: opts.organizationId,
    type: "project_member_added",
    title: "프로젝트에 초대되었습니다",
    body: `${opts.actorName}님이 「${opts.projectName}」 프로젝트에 추가했습니다`,
    link: projectDetailLink(opts.projectId),
  });
}

export async function notifyProjectStatusChanged(
  db: D1Database,
  env: Env | undefined,
  opts: {
    projectId: string;
    projectName: string;
    actorId: string;
    organizationId: string;
    statusLabel: string;
  },
) {
  await notifyProjectMembers(db, env, {
    projectId: opts.projectId,
    actorId: opts.actorId,
    organizationId: opts.organizationId,
    type: "project_status",
    title: "프로젝트 상태가 변경되었습니다",
    body: `「${opts.projectName}」 → ${opts.statusLabel}`,
    link: projectDetailLink(opts.projectId),
  });
}

export async function notifyMilestoneCompleted(
  db: D1Database,
  env: Env | undefined,
  opts: {
    projectId: string;
    projectName: string;
    milestoneTitle: string;
    actorId: string;
    organizationId: string;
  },
) {
  await notifyProjectMembers(db, env, {
    projectId: opts.projectId,
    actorId: opts.actorId,
    organizationId: opts.organizationId,
    type: "milestone_done",
    title: "마일스톤이 완료되었습니다",
    body: `「${opts.projectName}」 · ${opts.milestoneTitle}`,
    link: projectMilestonesLink(opts.projectId),
  });
}

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
    link: taskDetailLink(opts.taskId),
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
  const dueLabel = formatDateKst(opts.dueAt);
  await createNotification(db, env, {
    userId: opts.assigneeId,
    organizationId: opts.organizationId,
    type: "task_due_soon",
    title: "업무 마감이 임박했습니다",
    body: `${opts.taskTitle} · ${dueLabel}`,
    link: taskDetailLink(opts.taskId),
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
    link: taskDetailLink(opts.taskId),
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
    link: taskDetailLink(opts.taskId),
  });
}

export async function notifyEventAttendee(
  db: D1Database,
  env: Env | undefined,
  opts: {
    attendeeId: string;
    actorId: string;
    actorName: string;
    organizationId: string;
    eventId: string;
    eventTitle: string;
    startAt: number;
  },
) {
  if (!opts.attendeeId || opts.attendeeId === opts.actorId) return;
  const when = formatEventDateTimeKst(opts.startAt);
  await createNotification(db, env, {
    userId: opts.attendeeId,
    organizationId: opts.organizationId,
    type: "event_attendee",
    title: "일정에 초대되었습니다",
    body: `${opts.actorName}님이 「${opts.eventTitle}」 · ${when}`,
    link: eventDetailLink(opts.eventId),
  });
}

export async function notifyEventReminder(
  db: D1Database,
  env: Env | undefined,
  opts: {
    userId: string;
    organizationId: string;
    eventId: string;
    eventTitle: string;
    reminderMinutes: number;
    startAt: number;
  },
) {
  if (!opts.userId) return;
  const startLabel = formatEventDateTimeKst(opts.startAt);
  const lead =
    opts.reminderMinutes >= 1440
      ? `${Math.round(opts.reminderMinutes / 1440)}일 전`
      : opts.reminderMinutes >= 60
        ? `${Math.round(opts.reminderMinutes / 60)}시간 전`
        : `${opts.reminderMinutes}분 전`;
  await createNotification(db, env, {
    userId: opts.userId,
    organizationId: opts.organizationId,
    type: "event_reminder",
    title: "일정이 곧 시작됩니다",
    body: `「${opts.eventTitle}」 · ${startLabel} (${lead} 알림)`,
    link: eventDetailLink(opts.eventId),
  });
}

export async function notifyMilestoneDue(
  db: D1Database,
  env: Env | undefined,
  opts: {
    userId: string;
    organizationId: string;
    projectId: string;
    projectName: string;
    milestoneTitle: string;
    dueAt: number;
  },
) {
  if (!opts.userId) return;
  const dueLabel = formatDateOnlyKst(opts.dueAt);
  await createNotification(db, env, {
    userId: opts.userId,
    organizationId: opts.organizationId,
    type: "milestone_due",
    title: "마일스톤 마감이 다가옵니다",
    body: `${opts.projectName} · ${opts.milestoneTitle} (${dueLabel} 마감)`,
    link: projectMilestonesLink(opts.projectId),
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
    link: eventDetailLink(opts.eventId),
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
    link: eventDetailLink(opts.eventId),
  });
}
