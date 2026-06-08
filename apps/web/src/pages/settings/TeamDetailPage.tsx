import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  useTeamDetail,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useUpdateTeamMember,
  useRemoveTeamMember,
} from "../../hooks/useOrgSettings";
import { useOrgMembers } from "../../hooks/useAdmin";
import { cn } from "../../lib/cn";

const TEAM_COLORS = ["#4A9FE8", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useTeamDetail(teamId);
  const { data: membersData } = useOrgMembers();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const updateMember = useUpdateTeamMember();
  const removeMember = useRemoveTeamMember();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#4A9FE8");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const team = data?.team;
  const members = data?.members ?? [];
  const canManage = data?.canManage ?? false;

  useEffect(() => {
    if (team) {
      setName(team.name);
      setColor(team.color);
    }
  }, [team]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const availableMembers = useMemo(() => {
    const inTeam = new Set(members.map((m) => m.userId));
    return (membersData?.members ?? []).filter(
      (m) => m.status === "active" && !inTeam.has(m.user_id),
    );
  }, [members, membersData]);

  const handleSave = async () => {
    if (!teamId || !name.trim()) return;
    try {
      await updateTeam.mutateAsync({ teamId, name: name.trim(), color });
      setToast({ tone: "info", message: "팀 정보를 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
    }
  };

  const handleDelete = async () => {
    if (!teamId || !confirm("이 팀을 삭제할까요? 연결된 일정이 있으면 삭제할 수 없습니다.")) return;
    try {
      await deleteTeam.mutateAsync(teamId);
      navigate("/settings/teams", { replace: true });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "삭제 실패" });
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !selectedUserId) return;
    try {
      await addMember.mutateAsync({ teamId, userId: selectedUserId });
      setSelectedUserId("");
      setShowAdd(false);
      setToast({ tone: "info", message: "팀 멤버를 추가했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "추가 실패" });
    }
  };

  const toggleLead = async (userId: string, currentRole: string) => {
    if (!teamId) return;
    const nextRole = currentRole === "lead" ? "member" : "lead";
    try {
      await updateMember.mutateAsync({ teamId, userId, role: nextRole });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "역할 변경 실패" });
    }
  };

  const handleRemove = async (userId: string, memberName: string) => {
    if (!teamId || !confirm(`${memberName}님을 팀에서 제거할까요?`)) return;
    try {
      await removeMember.mutateAsync({ teamId, userId });
      setToast({ tone: "info", message: "팀 멤버를 제거했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "제거 실패" });
    }
  };

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>;
  }

  if (!team) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-navy-600">팀을 찾을 수 없습니다.</p>
        <button
          type="button"
          onClick={() => navigate("/settings/teams")}
          className="mt-3 text-sm text-primary-600"
        >
          팀 목록으로
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/settings/teams")}
        className="flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900"
      >
        <ChevronLeft className="h-4 w-4" />
        팀 관리
      </button>

      <PageHeader title={team.name} subtitle={`${members.length}명`} />

      {canManage && (
        <GlassCard className="space-y-4 p-5">
          <Input label="팀 이름" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">색상</p>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: color === c ? "#1e3a5f" : "transparent" }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updateTeam.isPending} className="flex-1">
              {updateTeam.isPending ? "저장 중..." : "저장"}
            </Button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteTeam.isPending}
              className="flex h-11 items-center justify-center rounded-xl border border-red-200 px-4 text-red-500 hover:bg-red-50"
              aria-label="팀 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </GlassCard>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy-900">멤버</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-sm font-medium text-primary-600"
          >
            <UserPlus className="h-4 w-4" />
            추가
          </button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <GlassCard key={member.userId} className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10 text-sm font-semibold text-primary-600">
              {member.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-navy-900 truncate">{member.name}</p>
              <p className="text-xs text-navy-600 truncate">{member.email ?? ""}</p>
            </div>
            {canManage ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleLead(member.userId, member.role)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs font-medium",
                    member.role === "lead"
                      ? "bg-primary-400/15 text-primary-700"
                      : "bg-sky-100 text-navy-600",
                  )}
                >
                  {member.role === "lead" ? "리드" : "멤버"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(member.userId, member.name)}
                  className="text-xs text-red-500"
                >
                  제거
                </button>
              </div>
            ) : (
              <span className="text-xs text-navy-500">{member.role === "lead" ? "리드" : "멤버"}</span>
            )}
          </GlassCard>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="팀 멤버 추가">
        <form onSubmit={handleAddMember} className="space-y-4">
          <label className="block text-sm text-navy-700">
            조직 멤버
            <select
              className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">선택하세요</option>
              {availableMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </label>
          {availableMembers.length === 0 && (
            <p className="text-xs text-navy-500">추가할 수 있는 멤버가 없습니다.</p>
          )}
          <Button type="submit" disabled={addMember.isPending || !selectedUserId} className="w-full">
            {addMember.isPending ? "추가 중..." : "추가"}
          </Button>
        </form>
      </Modal>

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
