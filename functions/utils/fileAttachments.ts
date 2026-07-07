export type EntityFileRow = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  commentId: string | null;
  createdAt: number;
};

export async function fetchFileCountsForEntities(
  db: D1Database,
  entityType: string,
  entityIds: string[],
): Promise<Record<string, number>> {
  if (entityIds.length === 0) return {};

  const placeholders = entityIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT entity_id, COUNT(*) as c
       FROM files
       WHERE entity_type = ? AND entity_id IN (${placeholders}) AND comment_id IS NULL
       GROUP BY entity_id`,
    )
    .bind(entityType, ...entityIds)
    .all();

  const map: Record<string, number> = {};
  for (const row of results ?? []) {
    const r = row as { entity_id: string; c: number };
    map[r.entity_id] = r.c;
  }
  return map;
}

export async function fetchFilesForComments(
  db: D1Database,
  entityType: string,
  entityId: string,
  commentIds: string[],
): Promise<Record<string, EntityFileRow[]>> {
  if (commentIds.length === 0) return {};

  const placeholders = commentIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT id, filename, mime_type, size_bytes, comment_id, created_at
       FROM files
       WHERE entity_type = ? AND entity_id = ? AND comment_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .bind(entityType, entityId, ...commentIds)
    .all();

  const map: Record<string, EntityFileRow[]> = {};
  for (const row of results ?? []) {
    const r = row as Record<string, unknown>;
    const commentId = r.comment_id as string;
    if (!map[commentId]) map[commentId] = [];
    map[commentId].push({
      id: r.id as string,
      filename: r.filename as string,
      mimeType: r.mime_type as string,
      sizeBytes: r.size_bytes as number,
      commentId,
      createdAt: r.created_at as number,
    });
  }
  return map;
}

export function mapFileRows(results: unknown[]): EntityFileRow[] {
  return (results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      filename: r.filename as string,
      mimeType: r.mime_type as string,
      sizeBytes: r.size_bytes as number,
      commentId: (r.comment_id as string | null) ?? null,
      createdAt: r.created_at as number,
    };
  });
}
