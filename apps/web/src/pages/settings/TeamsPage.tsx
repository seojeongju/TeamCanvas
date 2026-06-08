import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useTeamsManage, useCreateTeam } from "../../hooks/useOrgSettings";
import { useHasPermission } from "../../hooks/usePermissions";

const TEAM_COLORS = ["#4A9FE8", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export function TeamsPage() {
  const navigate = useNavigate();
  const canManage = useHasPermission("teams:manage");
  const { data, isLoading } = useTeamsManage();
  const createTeam = useCreateTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createTeam.mutateAsync({ name: name.trim(), color });
      setName("");
      setColor(TEAM_COLORS[0]);
      setShowCreate(false);
      setToast({ tone: "info", message: "팀을 만들었습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "팀 생성 실패" });
    }
  };

  const teams = data?.teams ?? [];
  const limits = data?.limits;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/more")}
        className="flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900"
      >
        <ChevronLeft className="h-4 w-4" />
        더보기
      </button>

      <PageHeader
        title="팀 관리"
        subtitle={limits ? `팀 ${limits.current} / ${limits.limit}개` : undefined}
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              disabled={limits ? !limits.ok : false}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600 hover:bg-white/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              팀 만들기
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : teams.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-navy-600">소속된 팀이 없습니다.</p>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-medium text-primary-600"
            >
              첫 팀 만들기
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => navigate(`/settings/teams/${team.id}`)}
              className="w-full text-left"
            >
              <GlassCard className="flex items-center gap-4 p-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: team.color }}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-900 truncate">{team.name}</p>
                  <p className="text-xs text-navy-600">{team.memberCount ?? 0}명</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-navy-600/40" />
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="팀 만들기">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="팀 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 개발팀"
            required
            autoFocus
          />
          <div>
            <p className="mb-2 text-sm font-medium text-navy-700">색상</p>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full border-2 transition"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#1e3a5f" : "transparent",
                  }}
                  aria-label={`색상 ${c}`}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={createTeam.isPending} className="w-full">
            {createTeam.isPending ? "생성 중..." : "팀 만들기"}
          </Button>
        </form>
      </Modal>

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
