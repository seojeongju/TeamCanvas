import { insertProjectActivity } from "./projectActivities";
import { newId, now } from "./helpers";

type ProjectRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  name: string;
  color: string;
};

type EventRow = {
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
};

type TaskRow = {
  id: string;
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
  opts: {
    actorId: string;
    orgId: string;
    teamId: string | null;
    ts: number;
  },
): Promise<string | null> {
  const event = await db
    .prepare(
      `SELECT organization_id, team_id, title, description, location, start_at, end_at, all_day,
              visibility, recurrence_rule, excluded_dates_json, color
       FROM events WHERE id = ?`,
    )
    .bind(sourceEventId)
    .first<EventRow>();

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
      .prepare(
        "INSERT OR IGNORE INTO event_attendees (event_id, user_id, rsvp) VALUES (?, ?, ?)",
      )
      .bind(eventId, attendee.user_id, attendee.rsvp)
      .run();
  }

  const { results: reminders } = await db
    .prepare(
      `SELECT organization_id, user_id, reminder_minutes, remind_at
       FROM event_reminders
       WHERE event_id = ? AND delivered_at IS NULL AND remind_at > ?`,
    )
    .bind(sourceEventId, opts.ts)
    .all<{ organization_id: string; user_id: string; reminder_minutes: number; remind_at: number }>();

  for (const reminder of reminders ?? []) {
    await db
      .prepare(
        `INSERT INTO event_reminders (id, event_id, organization_id, user_id, reminder_minutes, remind_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        eventId,
        reminder.organization_id,
        reminder.user_id,
        reminder.reminder_minutes,
        reminder.remind_at,
        opts.ts,
      )
      .run();
  }

  return eventId;
}

async function copyTaskChecklist(
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

async function copyTaskLabels(db: D1Database, sourceTaskId: string, targetTaskId: string): Promise<void> {
  const { results: labels } = await db
    .prepare("SELECT label_id FROM task_label_assignments WHERE task_id = ?")
    .bind(sourceTaskId)
    .all<{ label_id: string }>();

  for (const label of labels ?? []) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO task_label_assignments (task_id, label_id) VALUES (?, ?)",
      )
      .bind(targetTaskId, label.label_id)
      .run();
  }
}

async function copyTaskRow(
  db: D1Database,
  row: TaskRow,
  opts: {
    targetProjectId: string;
    orgId: string;
    teamId: string | null;
    actorId: string;
    parentTaskId: string | null;
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
      orgId: opts.orgId,
      teamId: opts.teamId,
      ts: opts.ts,
    });
  }

  const status = opts.resetStatus ? "todo" : row.status;
  const priority = row.priority ?? "medium";

  await db
    .prepare(
      `INSERT INTO tasks (
        id, organization_id, team_id, project_id, parent_task_id, creator_id, assignee_id,
        title, description, status, priority, due_at, event_id, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newTaskId,
      opts.orgId,
      opts.teamId,
      opts.targetProjectId,
      opts.parentTaskId,
      opts.actorId,
      row.assignee_id ?? opts.actorId,
      row.title,
      row.description,
      status,
      priority,
      row.due_at,
      eventId,
      row.sort_order ?? 0,
      opts.ts,
      opts.ts,
    )
    .run();

  await copyTaskChecklist(db, row.id, newTaskId, opts.resetStatus, opts.ts);
  await copyTaskLabels(db, row.id, newTaskId);

  return newTaskId;
}

export async function copyProjectWork(
  db: D1Database,
  opts: {
    sourceProjectId: string;
    targetProjectId: string;
    actorId: string;
    orgId: string;
    includeMilestones?: boolean;
    includeSchedules?: boolean;
    resetStatus?: boolean;
    activitySummary?: string;
  },
): Promise<{ milestoneCount: number; taskCount: number; subtaskCount: number }> {
  if (opts.sourceProjectId === opts.targetProjectId) throw new Error("same_project");

  const source = await db
    .prepare(
      "SELECT id, organization_id, team_id, name, color FROM projects WHERE id = ? AND organization_id = ?",
    )
    .bind(opts.sourceProjectId, opts.orgId)
    .first<ProjectRow>();
  if (!source) throw new Error("source_not_found");

  const target = await db
    .prepare(
      "SELECT id, organization_id, team_id, name, color FROM projects WHERE id = ? AND organization_id = ?",
    )
    .bind(opts.targetProjectId, opts.orgId)
    .first<ProjectRow>();
  if (!target) throw new Error("target_not_found");

  const includeMilestones = opts.includeMilestones !== false;
  const includeSchedules = opts.includeSchedules !== false;
  const resetStatus = opts.resetStatus !== false;
  const ts = now();
  const teamId = target.team_id ?? source.team_id;

  let milestoneCount = 0;
  if (includeMilestones) {
    const { results: milestones } = await db
      .prepare(
        `SELECT id, title, description, due_at, status, sort_order, calendar_event_id
         FROM project_milestones
         WHERE project_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(opts.sourceProjectId)
      .all<{
        id: string;
        title: string;
        description: string | null;
        due_at: number | null;
        status: string;
        sort_order: number;
        calendar_event_id: string | null;
      }>();

    for (const milestone of milestones ?? []) {
      let calendarEventId: string | null = null;
      if (includeSchedules && milestone.calendar_event_id) {
        calendarEventId =
          (await copyEvent(db, milestone.calendar_event_id, {
            actorId: opts.actorId,
            orgId: opts.orgId,
            teamId,
            ts,
          })) ?? null;
      }

      await db
        .prepare(
          `INSERT INTO project_milestones (
            id, project_id, title, description, due_at, status, sort_order, calendar_event_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          opts.targetProjectId,
          milestone.title,
          milestone.description,
          milestone.due_at,
          resetStatus ? "pending" : milestone.status,
          milestone.sort_order ?? milestoneCount,
          calendarEventId,
          ts,
          ts,
        )
        .run();
      milestoneCount++;
    }
  }

  const { results: allTasks } = await db
    .prepare(
      `SELECT id, parent_task_id, creator_id, assignee_id, title, description, status, priority, due_at, event_id, sort_order
       FROM tasks
       WHERE project_id = ?
       ORDER BY (parent_task_id IS NOT NULL), sort_order ASC, created_at ASC`,
    )
    .bind(opts.sourceProjectId)
    .all<TaskRow>();

  const taskIdMap = new Map<string, string>();
  let taskCount = 0;
  let subtaskCount = 0;

  const taskOpts = {
    targetProjectId: opts.targetProjectId,
    orgId: opts.orgId,
    teamId,
    actorId: opts.actorId,
    includeSchedules,
    resetStatus,
    ts,
  };

  for (const row of allTasks ?? []) {
    if (row.parent_task_id) continue;
    const newTaskId = await copyTaskRow(db, row, { ...taskOpts, parentTaskId: null });
    taskIdMap.set(row.id, newTaskId);
    taskCount++;
  }

  for (const row of allTasks ?? []) {
    if (!row.parent_task_id) continue;
    const newParentId = taskIdMap.get(row.parent_task_id);
    if (!newParentId) continue;
    const newTaskId = await copyTaskRow(db, row, { ...taskOpts, parentTaskId: newParentId });
    taskIdMap.set(row.id, newTaskId);
    subtaskCount++;
  }

  const sourceTaskIds = [...taskIdMap.keys()];
  if (sourceTaskIds.length > 0) {
    const placeholders = sourceTaskIds.map(() => "?").join(",");
    const { results: dependencies } = await db
      .prepare(
        `SELECT task_id, depends_on_task_id FROM task_dependencies
         WHERE task_id IN (${placeholders})`,
      )
      .bind(...sourceTaskIds)
      .all<{ task_id: string; depends_on_task_id: string }>();

    for (const dep of dependencies ?? []) {
      const newTaskId = taskIdMap.get(dep.task_id);
      const newDependsId = taskIdMap.get(dep.depends_on_task_id);
      if (!newTaskId || !newDependsId) continue;
      await db
        .prepare(
          "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)",
        )
        .bind(newTaskId, newDependsId)
        .run();
    }
  }

  await db
    .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
    .bind(ts, opts.targetProjectId)
    .run();

  const summary =
    opts.activitySummary ??
    `「${source.name}」에서 업무 구성 복사 (업무 ${taskCount + subtaskCount}건, 마일스톤 ${milestoneCount}건)`;

  await insertProjectActivity(db, {
    projectId: opts.targetProjectId,
    organizationId: opts.orgId,
    actorId: opts.actorId,
    action: "updated",
    field: "copy_work",
    summary,
  });

  return { milestoneCount, taskCount, subtaskCount };
}
