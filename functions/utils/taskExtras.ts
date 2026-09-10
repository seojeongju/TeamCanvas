import { chunkIds } from "./d1Chunk";

export type TaskLabelRow = {
  id: string;
  name: string;
  color: string;
};

export async function fetchLabelsForTasks(
  db: D1Database,
  taskIds: string[],
): Promise<Record<string, TaskLabelRow[]>> {
  if (taskIds.length === 0) return {};

  const map: Record<string, TaskLabelRow[]> = {};

  for (const chunk of chunkIds(taskIds)) {
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT tla.task_id, l.id, l.name, l.color
         FROM task_label_assignments tla
         JOIN task_labels l ON l.id = tla.label_id
         WHERE tla.task_id IN (${placeholders})`,
      )
      .bind(...chunk)
      .all();

    for (const row of results ?? []) {
      const r = row as Record<string, unknown>;
      const taskId = r.task_id as string;
      if (!map[taskId]) map[taskId] = [];
      map[taskId].push({
        id: r.id as string,
        name: r.name as string,
        color: r.color as string,
      });
    }
  }

  return map;
}

export async function syncTaskLabels(
  db: D1Database,
  taskId: string,
  labelIds: string[],
  orgId: string,
) {
  if (labelIds.length > 0) {
    const valid = new Set<string>();
    for (const chunk of chunkIds(labelIds)) {
      const placeholders = chunk.map(() => "?").join(",");
      const { results } = await db
        .prepare(
          `SELECT id FROM task_labels WHERE organization_id = ? AND id IN (${placeholders})`,
        )
        .bind(orgId, ...chunk)
        .all();
      for (const row of results ?? []) {
        valid.add((row as { id: string }).id);
      }
    }
    labelIds = labelIds.filter((id) => valid.has(id));
  }

  await db.prepare("DELETE FROM task_label_assignments WHERE task_id = ?").bind(taskId).run();
  for (const labelId of labelIds) {
    await db
      .prepare("INSERT INTO task_label_assignments (task_id, label_id) VALUES (?, ?)")
      .bind(taskId, labelId)
      .run();
  }
}
