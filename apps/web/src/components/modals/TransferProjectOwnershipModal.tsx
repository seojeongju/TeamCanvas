import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useProjectMembers, useTransferProjectOwnership } from "../../hooks/useData";
import type { Project } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

type Props = {
  project: Project;
  open: boolean;
  onClose: () => void;
};

export function TransferProjectOwnershipModal({ project, open, onClose }: Props) {
  const { data } = useProjectMembers(open ? project.id : undefined);
  const transfer = useTransferProjectOwnership();
  const [newOwnerId, setNewOwnerId] = useState("");

  const candidates = (data?.members ?? []).filter((m) => m.userId !== project.ownerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerId) return;
    if (!window.confirm("소유권을 이전하면 매니저 역할로 변경됩니다. 계속할까요?")) return;

    await transfer.mutateAsync({ projectId: project.id, newOwnerId });
    setNewOwnerId("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="소유권 이전">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          프로젝트 소유권을 다른 멤버에게 이전합니다. 이전 후 본인은 매니저 역할이 됩니다.
        </p>

        {candidates.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            이전할 수 있는 멤버가 없습니다. 먼저 멤버를 추가해 주세요.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">새 소유자</label>
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className={selectClass}
            >
              <option value="">멤버 선택</option>
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button type="submit" fullWidth disabled={!newOwnerId || transfer.isPending || candidates.length === 0}>
          {transfer.isPending ? "이전 중..." : "소유권 이전"}
        </Button>
      </form>
    </Modal>
  );
}
