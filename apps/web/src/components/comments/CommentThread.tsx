import { useMemo, useState } from "react";
import { CommentComposer } from "./CommentComposer";
import { CommentItem, type ThreadComment } from "./CommentItem";

type Member = { id: string; name: string };

type Props = {
  comments: ThreadComment[];
  entityType: "task" | "project";
  entityId: string;
  members: Member[];
  currentUserId?: string;
  canWrite: boolean;
  isOrgAdmin?: boolean;
  isLoading?: boolean;
  emptyLabel?: string;
  createComment: (body: string, parentId?: string | null) => Promise<{ id: string }>;
  updateComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleReaction: (commentId: string, emoji: string) => Promise<void>;
  createPending?: boolean;
  actionPending?: boolean;
};

export function CommentThread({
  comments,
  entityType,
  entityId,
  members,
  currentUserId,
  canWrite,
  isOrgAdmin = false,
  isLoading,
  emptyLabel = "첫 댓글을 남겨보세요.",
  createComment,
  updateComment,
  deleteComment,
  toggleReaction,
  createPending,
  actionPending,
}: Props) {
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null);

  const { roots, repliesByParent } = useMemo(() => {
    const rootsList = comments.filter((c) => !c.parentId);
    const map = new Map<string, ThreadComment[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      const list = map.get(comment.parentId) ?? [];
      list.push(comment);
      map.set(comment.parentId, list);
    }
    return { roots: rootsList, repliesByParent: map };
  }, [comments]);

  const canModifyComment = (userId: string) =>
    !!currentUserId && (userId === currentUserId || isOrgAdmin);

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-navy-500">불러오는 중...</p>
        ) : roots.length === 0 ? (
          <p className="text-xs text-navy-500">{emptyLabel}</p>
        ) : (
          roots.map((root) => (
            <div key={root.id} className="space-y-2">
              <CommentItem
                comment={root}
                members={members}
                canModify={canModifyComment(root.userId)}
                canReply={canWrite}
                busy={actionPending}
                onReply={() => setReplyTo({ id: root.id, userName: root.userName })}
                onEdit={(body) => updateComment(root.id, body)}
                onDelete={() => deleteComment(root.id)}
                onToggleReaction={(emoji) => toggleReaction(root.id, emoji)}
              />
              {(repliesByParent.get(root.id) ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={1}
                  members={members}
                  canModify={canModifyComment(reply.userId)}
                  canReply={false}
                  busy={actionPending}
                  onReply={() => {}}
                  onEdit={(body) => updateComment(reply.id, body)}
                  onDelete={() => deleteComment(reply.id)}
                  onToggleReaction={(emoji) => toggleReaction(reply.id, emoji)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {canWrite && (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between rounded-xl bg-sky-50/80 px-3 py-1.5 text-xs text-navy-600">
              <span>
                <strong>{replyTo.userName}</strong>에게 답글 작성 중
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-lg p-1 text-navy-400 hover:bg-white hover:text-navy-700"
                aria-label="답글 취소"
              >
                ×
              </button>
            </div>
          )}
          <CommentComposer
            members={members}
            entityType={entityType}
            entityId={entityId}
            disabled={createPending}
            placeholder={
              replyTo
                ? `${replyTo.userName}에게 답글... (@이름 멘션)`
                : "댓글 입력... (@이름 멘션)"
            }
            onSubmit={async (body) => {
              const created = await createComment(body, replyTo?.id ?? null);
              setReplyTo(null);
              return created;
            }}
          />
        </div>
      )}
    </div>
  );
}
