import { insertTaskActivity } from "./taskActivities";
import { newId, now } from "./helpers";

type TaskRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  creator_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: number | null;
  event_id: string | null;
  sort_order: number;
};

async function copyEvent(
  db: D1Database,
  sourceEventId: string,
  opts: { actorId: string; orgId: string; teamId: string | null; ts: number },
): Promise<string | null> {
  const event = await db
    .prepare(
      `SELECT organization_id, team_id, title, description, location, start_at, end_at, all_day,
              visibility, recurrence_rule, excluded_dates_json, color
       FROM events WHERE id = ?`,
    )
    .bind(sourceEventId)
    .first<{
      organization_id: string;
      team_id: string | null;
      title: string;
      description: string | null;
      location: string | null;
      start_at: number;
      end_at: number;
      all_day: number;
      visibility: string;
      recurrence_rule: string | null;
      excluded_dates_json: string | null;
      color: string | null;
    }>();

  if (!event || event.organization_id !== opts.orgId) return null;

  const eventId = newId();
  await db
    .prepare(
      `INSERT INTO events (
        id, organization_id, team_id, creator_id, title, description, location,
        start_at, end_at, all_day, visibility, recurrence_rule, excluded_dates_json, color, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      eventId,
      opts.orgId,
      opts.teamId ?? event.team_id,
      opts.actorId,
      event.title,
      event.description,
      event.location,
      event.start_at,
      event.end_at,
      event.all_day,
      event.visibility,
      event.recurrence_rule,
      event.excluded_dates_json,
      event.color,
      opts.ts,
      opts.ts,
    )
    .run();

  const { results: attendees } = await db
    .prepare("SELECT user_id, rsvp FROM event_attendees WHERE event_id = ?")
    .bind(sourceEventId)
    .all<{ user_id: string; rsvp: string }>();

  for (const attendee of attendees ?? []) {
    await db
      .prepare("INSERT OR IGNORE INTO event_attendees (event_id, user_id, rsvp) VALUES (?, ?, ?)")
      .bind(eventId, attendee.user_id, attendee.rsvp)
      .run();
  }

  return eventId;
}

async function copyChecklist(
  db: D1Database,
  sourceTaskId: string,
  targetTaskId: string,
  resetStatus: boolean,
  ts: number,
): Promise<void> {
  const { results: checklist } = await db
    .prepare(
      `SELECT title, done, sort_order FROM task_checklist_items
       WHERE task_id = ? ORDER BY sort_order, created_at`,
    )
    .bind(sourceTaskId)
    .all<{ title: string; done: number; sort_order: number }>();

  for (const item of checklist ?? []) {
    if (!item.title?.trim()) continue;
    await db
      .prepare(
        `INSERT INTO task_checklist_items (id, task_id, title, done, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        targetTaskId,
        item.title.trim(),
        resetStatus ? 0 : item.done,
        item.sort_order ?? 0,
        ts,
      )
      .run();
  }
}

async function copyLabels(db: D1Database, sourceTaskId: string, targetTaskId: string): Promise<void> {
  const { results: labels } = await db
    .prepare("SELECT label_id FROM task_label_assignments WHERE task_id = ?")
    .bind(sourceTaskId)
    .all<{ label_id: string }>();

  for (const label of labels ?? []) {
    await db
      .prepare("INSERT OR IGNORE INTO task_label_assignments (task_id, label_id) VALUES (?, ?)")
      .bind(targetTaskId, label.label_id)
      .run();
  }
}

async function insertCopiedTask(
  db: D1Database,
  row: TaskRow,
  opts: {
    actorId: string;
    parentTaskId: string | null;
    title: string;
    includeSchedules: boolean;
    resetStatus: boolean;
    ts: number;
  },
): Promise<string> {
  const newTaskId = newId();
  let eventId: string | null = null;

  if (opts.includeSchedules && row.event_id) {
    eventId = await copyEvent(db, row.event_id, {
      actorId: opts.actorId,
      orgId: row.organization_id,
      teamId: row.team_id,
      ts: opts.ts,
    });
  }

  await db
    .prepare(
      `INSERT INTO tasks (
        id, organization_id, team_id, project_id, parent_task_id, creator_id, assignee_id,
        title, description, status, priority, due_at, event_id, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newTaskId,
      row.organization_id,
      row.team_id,
      row.project_id,
      opts.parentTaskId,
      opts.actorId,
      row.assignee_id ?? opts.actorId,
      opts.title,
      row.description,
      opts.resetStatus ? "todo" : row.status,
      row.priority ?? "medium",
      row.due_at,
      eventId,
      (row.sort_order ?? 0) + 1,
      opts.ts,
      opts.ts,
    )
    .run();

  await copyChecklist(db, row.id, newTaskId, opts.resetStatus, opts.ts);
  await copyLabels(db, row.id, newTaskId);

  return newTaskId;
}

/** 같은 프로젝트(또는 동일 연결 상태) 안에서 업무를 복제한다. */
export async function duplicateTask(
  db: D1Database,
  opts: {
    sourceTaskId: string;
    actorId: string;
    includeSubtasks?: boolean;
    includeSchedules?: boolean;
    resetStatus?: boolean;
  },
): Promise<{ id: string; subtaskCount: number }> {
  const source = await db
    .prepare(
      `SELECT id, organization_id, team_id, project_id, parent_task_id, creator_id, assignee_id,
              title, description, status, priority, due_at, event_id, sort_order
       FROM tasks WHERE id = ?`,
    )
    .bind(opts.sourceTaskId)
    .first<TaskRow>();

  if (!source) throw new Error("not_found");

  const includeSubtasks = opts.includeSubtasks !== false;
  const includeSchedules = opts.includeSchedules !== false;
  const resetStatus = opts.resetStatus !== false;
  const ts = now();

  const baseTitle = source.title.trim() || "업무";
  const copyTitle = baseTitle.endsWith("(복사)") ? baseTitle : `${baseTitle} (복사)`;

  const newTaskId = await insertCopiedTask(db, source, {
    actorId: opts.actorId,
    parentTaskId: source.parent_task_id,
    title: copyTitle,
    includeSchedules,
    resetStatus,
    ts,
  });

  let subtaskCount = 0;
  const taskIdMap = new Map<string, string>([[source.id, newTaskId]]);

  if (includeSubtasks && !source.parent_task_id) {
    const { results: subtasks } = await db
      .prepare(
        `SELECT id, organization_id, team_id, project_id, parent_task_id, creator_id, assignee_id,
                title, description, status, priority, due_at, event_id, sort_order
         FROM tasks
         WHERE parent_task_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(source.id)
      .all<TaskRow>();

    for (const sub of subtasks ?? []) {
      const newSubId = await insertCopiedTask(db, sub, {
        actorId: opts.actorId,
        parentTaskId: newTaskId,
        title: sub.title,
        includeSchedules,
        resetStatus,
        ts,
      });
      taskIdMap.set(sub.id, newSubId);
      subtaskCount++;
    }
  }

  const sourceIds = [...taskIdMap.keys()];
  if (sourceIds.length > 1) {
    const placeholders = sourceIds.map(() => "?").join(",");
    const { results: deps } = await db
      .prepare(
        `SELECT task_id, depends_on_task_id FROM task_dependencies
         WHERE task_id IN (${placeholders}) AND depends_on_task_id IN (${placeholders})`,
      )
      .bind(...sourceIds, ...sourceIds)
      .all<{ task_id: string; depends_on_task_id: string }>();

    for (const dep of deps ?? []) {
      const newTask = taskIdMap.get(dep.task_id);
      const newDepends = taskIdMap.get(dep.depends_on_task_id);
      if (!newTask || !newDepends) continue;
      await db
        .prepare(
          "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)",
        )
        .bind(newTask, newDepends)
        .run();
    }
  }

  await insertTaskActivity(db, {
    taskId: newTaskId,
    organizationId: source.organization_id,
    actorId: opts.actorId,
    action: "created",
    summary: `「${source.title}」에서 복사됨`,
  });

  if (source.project_id) {
    await db
      .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
      .bind(ts, source.project_id)
      .run();
  }

  return { id: newTaskId, subtaskCount };
}
