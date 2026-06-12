import { useState } from "react";
import { Button } from "../ui/Button";
import { useCreateProjectComment, useProjectComments } from "../../hooks/useData";
import { canWriteProjectContent } from "../../lib/projectUtils";
import type { Project } from "../../lib/types";

type Props = {
  project: Project;
};

export function ProjectCommentsSection({ project }: Props) {
  const { data, isLoading } = useProjectComments(project.id);
  const createComment = useCreateProjectComment();
  const [body, setBody] = useState("");
  const canWrite = canWriteProjectContent(project.currentUserRole);
  const comments = data?.comments ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    await createComment.mutateAsync({ projectId: project.id, body: body.trim() });
    setBody("");
  };

  return (
    <div className="mt-5 border-t border-sky-100/80 pt-4">
      <h3 className="text-sm font-semibold text-navy-800">논의 {comments.length > 0 ? `(${comments.length})` : ""}</h3>
      <p className="mt-0.5 text-xs text-navy-500">프로젝트 관련 메모·토론 (@이름 멘션 가능)</p>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-navy-500">불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-navy-500">첫 댓글을 남겨보세요.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-white/60 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-navy-800">{c.userName}</span>
                <span className="shrink-0 text-[10px] text-navy-400">{c.time}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{c.body}</p>
            </div>
          ))
        )}
      </div>

      {canWrite && (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="댓글 입력... (@이름 멘션)"
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2 text-sm text-navy-900 outline-none focus:border-primary-400"
          />
          <Button type="submit" disabled={createComment.isPending || !body.trim()} className="shrink-0 self-end">
            등록
          </Button>
        </form>
      )}
    </div>
  );
}
