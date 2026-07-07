import { useState } from "react";
import { MessageSquareReply, Pencil, Smile, Trash2 } from "lucide-react";
import { CommentAttachments } from "./CommentAttachments";
import { MentionTextarea } from "../ui/MentionTextarea";
import { Button } from "../ui/Button";
import type { CommentReaction, EntityAttachment } from "../../lib/types";
import { cn } from "../../lib/cn";

export const COMMENT_REACTION_EMOJIS = ["👍", "❤️", "😄", "🎉", "👀"] as const;

export type ThreadComment = {
  id: string;
  userId: string;
  userName: string;
  body: string;
  time: string;
  parentId?: string | null;
  editedAt?: number | null;
  isDeleted?: boolean;
  attachments?: EntityAttachment[];
  reactions?: CommentReaction[];
};

type Member = { id: string; name: string };

type Props = {
  comment: ThreadComment;
  depth?: number;
  currentUserId?: string;
  canModify: boolean;
  canReply: boolean;
  members: Member[];
  busy?: boolean;
  onReply: () => void;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleReaction: (emoji: string) => Promise<void>;
};

export function CommentItem({
  comment,
  depth = 0,
  canModify,
  canReply,
  members,
  busy,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [showReactions, setShowReactions] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDeleted = comment.isDeleted;
  const reactionMap = new Map((comment.reactions ?? []).map((r) => [r.emoji, r]));

  const handleSaveEdit = async () => {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      await onEdit(editBody.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(depth > 0 && "ml-4 border-l-2 border-sky-100 pl-3")}>
      <div className="rounded-2xl bg-sky-50/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-navy-800">{comment.userName}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-navy-500">{comment.time}</span>
            {comment.editedAt ? (
              <span className="text-[10px] text-navy-400">(수정됨)</span>
            ) : null}
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <MentionTextarea
              value={editBody}
              onChange={setEditBody}
              members={members}
              rows={2}
              placeholder="댓글 수정..."
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="!min-h-8 !px-2 text-xs"
                onClick={() => {
                  setEditing(false);
                  setEditBody(comment.body);
                }}
              >
                취소
              </Button>
              <Button
                type="button"
                className="!min-h-8 !px-3 text-xs"
                disabled={saving || !editBody.trim()}
                onClick={() => void handleSaveEdit()}
              >
                저장
              </Button>
            </div>
          </div>
        ) : isDeleted ? (
          <p className="mt-1 text-sm italic text-navy-400">삭제된 댓글입니다.</p>
        ) : (
          <>
            <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{comment.body}</p>
            {comment.attachments && comment.attachments.length > 0 && (
              <CommentAttachments attachments={comment.attachments} />
            )}
          </>
        )}

        {!isDeleted && !editing && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {(comment.reactions ?? []).map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={busy}
                onClick={() => void onToggleReaction(r.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition",
                  r.reactedByMe
                    ? "bg-primary-400/15 text-primary-700 ring-1 ring-primary-300/60"
                    : "bg-white/70 text-navy-600 hover:bg-white",
                )}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}

            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowReactions((v) => !v)}
                className="rounded-lg p-1 text-navy-400 hover:bg-white/80 hover:text-navy-600"
                aria-label="리액션 추가"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              {showReactions && (
                <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-xl bg-white p-1 shadow-lg ring-1 ring-sky-100">
                  {COMMENT_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setShowReactions(false);
                        void onToggleReaction(emoji);
                      }}
                      className={cn(
                        "rounded-lg px-1.5 py-0.5 text-sm hover:bg-sky-50",
                        reactionMap.get(emoji)?.reactedByMe && "bg-primary-400/10",
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {canReply && (
              <button
                type="button"
                disabled={busy}
                onClick={onReply}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] text-navy-500 hover:bg-white/80"
              >
                <MessageSquareReply className="h-3 w-3" />
                답글
              </button>
            )}

            {canModify && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditBody(comment.body);
                    setEditing(true);
                  }}
                  className="rounded-lg p-1 text-navy-400 hover:bg-white/80 hover:text-navy-600"
                  aria-label="댓글 수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("이 댓글을 삭제할까요?")) void onDelete();
                  }}
                  className="rounded-lg p-1 text-navy-400 hover:bg-white/80 hover:text-red-500"
                  aria-label="댓글 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
