type BlockingDep = { id: string; title: string; status: string };

export async function getIncompleteDependencies(
  db: D1Database,
  taskId: string,
): Promise<BlockingDep[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.title, t.status
       FROM task_dependencies d
       JOIN tasks t ON t.id = d.depends_on_task_id
       WHERE d.task_id = ? AND t.status != 'done'`,
    )
    .bind(taskId)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
    };
  });
}

export async function wouldCreateDependencyCycle(
  db: D1Database,
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  if (taskId === dependsOnTaskId) return true;

  const queue = [dependsOnTaskId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);

    const { results } = await db
      .prepare("SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?")
      .bind(current)
      .all();

    for (const row of results ?? []) {
      queue.push((row as { depends_on_task_id: string }).depends_on_task_id);
    }
  }

  return false;
}

export async function fetchDependenciesForTask(
  db: D1Database,
  taskId: string,
): Promise<
  Array<{
    id: string;
    dependsOnTaskId: string;
    title: string;
    status: string;
  }>
> {
  const { results } = await db
    .prepare(
      `SELECT d.id, d.depends_on_task_id, t.title, t.status
       FROM task_dependencies d
       JOIN tasks t ON t.id = d.depends_on_task_id
       WHERE d.task_id = ?
       ORDER BY d.created_at ASC`,
    )
    .bind(taskId)
    .all();

  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      dependsOnTaskId: r.depends_on_task_id as string,
      title: r.title as string,
      status: r.status as string,
    };
  });
}
