import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useAddProjectMember } from "../../hooks/useData";
import { PROJECT_MEMBER_ROLE_LABELS } from "../../lib/projectUtils";
import type { ProjectMember } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

const EDITABLE_ROLES = ["manager", "member", "viewer"] as const;

type Props = {
  projectId: string;
  member: ProjectMember | null;
  onClose: () => void;
};

export function EditProjectMemberModal({ projectId, member, onClose }: Props) {
  const addMember = useAddProjectMember();
  const [role, setRole] = useState("member");

  useEffect(() => {
    if (!member) return;
    setRole(member.role);
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    await addMember.mutateAsync({
      projectId,
      userId: member.userId,
      role,
    });
    onClose();
  };

  return (
    <Modal open={!!member} onClose={onClose} title="멤버 역할 수정">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-sky-50/60 px-3 py-2.5 text-sm text-navy-800">
          <p className="font-medium">{member?.name}</p>
          {member?.email && <p className="text-xs text-navy-500">{member.email}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">역할</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            {EDITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {PROJECT_MEMBER_ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" fullWidth disabled={addMember.isPending}>
          {addMember.isPending ? "저장 중..." : "역할 저장"}
        </Button>
      </form>
    </Modal>
  );
}
