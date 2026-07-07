import { CommentThread } from "../comments/CommentThread";
import { useOrgMembers } from "../../hooks/useAdmin";
import {
  useCreateProjectComment,
  useDeleteProjectComment,
  useProjectComments,
  useToggleProjectCommentReaction,
  useUpdateProjectComment,
} from "../../hooks/useData";
import { useCurrentOrgRole } from "../../hooks/usePermissions";
import { isOrgAdminRole } from "../../lib/deletePermissions";
import { canWriteProjectContent } from "../../lib/projectUtils";
import { useAuthStore } from "../../stores/authStore";
import type { Project } from "../../lib/types";

type Props = {
  project: Project;
};

export function ProjectCommentsSection({ project }: Props) {
  const { data, isLoading } = useProjectComments(project.id);
  const { data: membersData } = useOrgMembers();
  const createComment = useCreateProjectComment();
  const updateComment = useUpdateProjectComment();
  const deleteComment = useDeleteProjectComment();
  const toggleReaction = useToggleProjectCommentReaction();
  const user = useAuthStore((s) => s.user);
  const orgRole = useCurrentOrgRole();
  const isAdmin = isOrgAdminRole(orgRole);
  const canWrite = canWriteProjectContent(project.currentUserRole);
  const comments = data?.comments ?? [];
  const members = membersData?.members ?? [];

  return (
    <div className="mt-5 border-t border-sky-100/80 pt-4">
      <h3 className="text-sm font-semibold text-navy-800">논의 {comments.length > 0 ? `(${comments.length})` : ""}</h3>
      <p className="mt-0.5 text-xs text-navy-500">프로젝트 관련 메모·토론 (@이름 멘션 가능)</p>

      <div className="mt-3">
        <CommentThread
          comments={comments}
          entityType="project"
          entityId={project.id}
          members={members.map((m) => ({ id: m.user_id, name: m.name }))}
          currentUserId={user?.id}
          canWrite={canWrite}
          isOrgAdmin={isAdmin}
          isLoading={isLoading}
          createPending={createComment.isPending}
          actionPending={
            updateComment.isPending || deleteComment.isPending || toggleReaction.isPending
          }
          createComment={async (body, parentId) =>
            createComment.mutateAsync({ projectId: project.id, body, parentId })
          }
          updateComment={async (commentId, body) => {
            await updateComment.mutateAsync({ projectId: project.id, commentId, body });
          }}
          deleteComment={async (commentId) => {
            await deleteComment.mutateAsync({ projectId: project.id, commentId });
          }}
          toggleReaction={async (commentId, emoji) => {
            await toggleReaction.mutateAsync({ projectId: project.id, commentId, emoji });
          }}
        />
      </div>
    </div>
  );
}
