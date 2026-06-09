import { newId, now } from "./helpers";

export async function createNotification(
  db: D1Database,
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

export async function notifyTaskAssigned(
  db: D1Database,
  opts: {
    assigneeId: string;
    actorId: string;
    organizationId: string;
    taskId: string;
    taskTitle: string;
  },
) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  await createNotification(db, {
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
  await createNotification(db, {
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
  await createNotification(db, {
    userId: opts.recipientId,
    organizationId: opts.organizationId,
    type: "task_comment",
    title: "업무에 댓글이 달렸습니다",
    body: `${opts.taskTitle}: ${opts.preview}`,
    link: `/tasks?task=${opts.taskId}`,
  });
}
