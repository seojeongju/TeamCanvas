import { isOrgAdmin } from "./deleteGuards";
import type { ReactionSummary } from "./commentReactions";

export type CommentEntityType = "task" | "project";

export function canModifyComment(
  commentUserId: string,
  actorId: string,
  orgRole: string,
): boolean {
  return commentUserId === actorId || isOrgAdmin(orgRole);
}

export function mapCommentRow(
  row: Record<string, unknown>,
  formatTime: (ts: number) => string,
  entityKey: "task_id" | "project_id",
  entityIdKey: "taskId" | "projectId",
) {
  const createdAt = row.created_at as number;
  const deletedAt = (row.deleted_at as number | null) ?? null;
  return {
    id: row.id as string,
    [entityIdKey]: row[entityKey] as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    body: deletedAt ? "" : (row.body as string),
    createdAt,
    time: formatTime(createdAt),
    parentId: (row.parent_id as string | null) ?? null,
    editedAt: (row.edited_at as number | null) ?? null,
    deletedAt,
    isDeleted: !!deletedAt,
  };
}

export function enrichCommentsWithMeta<
  T extends { id: string; attachments?: unknown[] },
>(
  comments: T[],
  attachmentMap: Record<string, unknown[]>,
  reactionMap: Record<string, ReactionSummary[]>,
) {
  return comments.map((cm) => ({
    ...cm,
    attachments: (attachmentMap[cm.id] ?? []).map((f) => {
      const file = f as {
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      };
      return {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      };
    }),
    reactions: reactionMap[cm.id] ?? [],
  }));
}

export async function validateCommentParent(
  db: D1Database,
  table: "task_comments" | "project_comments",
  entityColumn: "task_id" | "project_id",
  entityId: string,
  parentId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const parent = await db
    .prepare(
      `SELECT id, ${entityColumn} as entity_id, deleted_at FROM ${table} WHERE id = ?`,
    )
    .bind(parentId)
    .first<{ id: string; entity_id: string; deleted_at: number | null }>();

  if (!parent || parent.entity_id !== entityId) {
    return { ok: false, error: "Invalid parent comment", status: 400 };
  }
  if (parent.deleted_at) {
    return { ok: false, error: "Cannot reply to deleted comment", status: 400 };
  }
  return { ok: true };
}
