import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { OrgMember } from "../../lib/types";

const roleLabels: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  invited: "초대됨",
};

const selectClass =
  "mt-1 min-h-12 w-full rounded-2xl border border-sky-200/80 bg-white/80 px-4 text-[15px] text-navy-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

export function MemberEditModal({
  member,
  open,
  onClose,
  canManage,
  isSelf,
  actorRole,
  onSave,
  onRemove,
  saving,
  removing,
}: {
  member: OrgMember | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  isSelf: boolean;
  actorRole: string;
  onSave: (data: { name: string; role?: string; status?: string }) => Promise<void>;
  onRemove?: () => Promise<void>;
  saving?: boolean;
  removing?: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setRole(member.role);
    setStatus(member.status);
  }, [member]);

  if (!member) return null;

  const canEditName = canManage || isSelf;
  const canEditRole =
    canManage &&
    !isSelf &&
    member.role !== "owner" &&
    (actorRole === "owner" || member.role !== "admin");
  const canEditStatus = canManage && !isSelf && member.role !== "owner";
  const canRemove = canManage && !isSelf && member.role !== "owner" && !!onRemove;

  const roleOptions =
    actorRole === "owner"
      ? (["admin", "member", "guest"] as const)
      : (["member", "guest"] as const);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: { name: string; role?: string; status?: string } = { name: name.trim() };
    if (canEditRole && role !== member.role) payload.role = role;
    if (canEditStatus && status !== member.status) payload.status = status;
    await onSave(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSelf ? "내 프로필" : "멤버 관리"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEditName || saving}
          maxLength={80}
          required
        />

        <div>
          <p className="text-sm font-medium text-navy-700">이메일</p>
          <p className="mt-1 truncate text-sm text-navy-600">{member.email ?? "—"}</p>
        </div>

        {canEditRole ? (
          <label className="block text-sm font-medium text-navy-700">
            역할
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={saving}
              className={selectClass}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div>
            <p className="text-sm font-medium text-navy-700">역할</p>
            <p className="mt-1 text-sm text-navy-600">{roleLabels[member.role] ?? member.role}</p>
          </div>
        )}

        {canEditStatus ? (
          <label className="block text-sm font-medium text-navy-700">
            상태
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving}
              className={selectClass}
            >
              <option value="active">{statusLabels.active}</option>
              <option value="suspended">{statusLabels.suspended}</option>
            </select>
          </label>
        ) : member.status !== "active" ? (
          <div>
            <p className="text-sm font-medium text-navy-700">상태</p>
            <p className="mt-1 text-sm text-navy-600">{statusLabels[member.status] ?? member.status}</p>
          </div>
        ) : null}

        {(member.teams?.length ?? 0) > 0 && (
          <div>
            <p className="text-sm font-medium text-navy-700">소속 팀</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.teams!.map((t) => (
                <span
                  key={t.id}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || !canEditName}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50"
            disabled={removing || saving}
            onClick={() => onRemove?.()}
          >
            {removing ? "제거 중…" : "조직에서 제거"}
          </Button>
        )}
      </form>
    </Modal>
  );
}
