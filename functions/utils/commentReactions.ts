import { newId } from "./helpers";

export const COMMENT_REACTION_EMOJIS = ["👍", "❤️", "😄", "🎉", "👀"] as const;

export type CommentReactionEmoji = (typeof COMMENT_REACTION_EMOJIS)[number];

export type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export function isAllowedReactionEmoji(emoji: string): emoji is CommentReactionEmoji {
  return (COMMENT_REACTION_EMOJIS as readonly string[]).includes(emoji);
}

export async function fetchReactionsForComments(
  db: D1Database,
  entityType: "task" | "project",
  commentIds: string[],
  currentUserId: string,
): Promise<Record<string, ReactionSummary[]>> {
  if (commentIds.length === 0) return {};

  const placeholders = commentIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT comment_id, emoji, user_id FROM comment_reactions
       WHERE entity_type = ? AND comment_id IN (${placeholders})`,
    )
    .bind(entityType, ...commentIds)
    .all();

  const map = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();

  for (const row of results ?? []) {
    const r = row as { comment_id: string; emoji: string; user_id: string };
    if (!map.has(r.comment_id)) map.set(r.comment_id, new Map());
    const emojiMap = map.get(r.comment_id)!;
    const entry = emojiMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
    entry.count += 1;
    if (r.user_id === currentUserId) entry.reactedByMe = true;
    emojiMap.set(r.emoji, entry);
  }

  const out: Record<string, ReactionSummary[]> = {};
  for (const [commentId, emojiMap] of map) {
    out[commentId] = Array.from(emojiMap.entries()).map(([emoji, value]) => ({
      emoji,
      count: value.count,
      reactedByMe: value.reactedByMe,
    }));
  }
  return out;
}

export async function toggleCommentReaction(
  db: D1Database,
  entityType: "task" | "project",
  commentId: string,
  userId: string,
  emoji: string,
): Promise<{ added: boolean }> {
  const existing = await db
    .prepare(
      `SELECT id FROM comment_reactions
       WHERE entity_type = ? AND comment_id = ? AND user_id = ? AND emoji = ?`,
    )
    .bind(entityType, commentId, userId, emoji)
    .first<{ id: string }>();

  if (existing) {
    await db.prepare("DELETE FROM comment_reactions WHERE id = ?").bind(existing.id).run();
    return { added: false };
  }

  await db
    .prepare(
      `INSERT INTO comment_reactions (id, entity_type, comment_id, user_id, emoji, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), entityType, commentId, userId, emoji, Date.now())
    .run();

  return { added: true };
}
