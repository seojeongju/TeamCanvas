import { useMemo, useState } from "react";
import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { EditProjectMemberModal } from "../modals/EditProjectMemberModal";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { useAddProjectMember, useProjectMembers, useRemoveProjectMember } from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import { PROJECT_MEMBER_ROLE_LABELS } from "../../lib/projectUtils";
import type { Project, ProjectMember } from "../../lib/types";
import { cn } from "../../lib/cn";

const selectClass =
  "min-h-10 w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 text-sm text-navy-900 outline-none focus:border-primary-400";

type Props = {
  project: Project;
};

export function ProjectMembersSection({ project }: Props) {
  const { data, isLoading } = useProjectMembers(project.id);
  const { data: orgMembersData } = useOrgMembers();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const canWrite = useHasPermission("projects:write");

  const members = data?.members ?? [];
  const orgMembers = orgMembersData?.members ?? [];
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [editMember, setEditMember] = useState<ProjectMember | null>(null);

  const available = useMemo(() => {
    const existing = new Set(members.map((m) => m.userId));
    return orgMembers.filter((m) => !existing.has(m.user_id));
  }, [members, orgMembers]);

  const handleAdd = async () => {
    if (!userId) return;
    await addMember.mutateAsync({ projectId: project.id, userId, role });
    setUserId("");
    setRole("member");
  };

  const handleRemove = (targetUserId: string, name: string) => {
    if (!window.confirm(`"${name}"님을 프로젝트에서 제외할까요?`)) return;
    removeMember.mutate({ projectId: project.id, userId: targetUserId });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-navy-800">멤버 ({members.length})</h2>

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <GlassCard key={m.userId} className="flex items-center gap-3 p-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                )}
                style={{ backgroundColor: project.color }}
              >
                {m.name.charAt(0)}
              </div>
              <button
                type="button"
                disabled={!canWrite || m.role === "owner"}
                onClick={() => canWrite && m.role !== "owner" && setEditMember(m)}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
              >
                <p className="font-medium text-navy-900">{m.name}</p>
                <p className="truncate text-xs text-navy-500">
                  {PROJECT_MEMBER_ROLE_LABELS[m.role] ?? m.role}
                  {m.email ? ` · ${m.email}` : ""}
                </p>
              </button>
              {canWrite && m.role !== "owner" && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditMember(m)}
                    className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-primary-600"
                    aria-label="역할 수정"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId, m.name)}
                    className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="제외"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {canWrite && available.length > 0 && (
        <GlassCard className="space-y-2 p-3">
          <p className="text-xs font-medium text-navy-700">멤버 추가</p>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectClass}>
            <option value="">조직 멤버 선택</option>
            {available.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            <option value="manager">매니저</option>
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
          </select>
          <Button type="button" fullWidth disabled={!userId || addMember.isPending} onClick={handleAdd}>
            <UserPlus className="h-4 w-4" />
            추가
          </Button>
        </GlassCard>
      )}

      <EditProjectMemberModal
        projectId={project.id}
        member={editMember}
        onClose={() => setEditMember(null)}
      />
    </section>
  );
}
