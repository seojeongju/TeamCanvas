import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { ListPagination } from "../../components/tasks/ListPagination";
import {
  useTeamsManage,
  useCreateTeam,
  useTeamRequests,
  useCreateTeamRequest,
  useApproveTeamRequest,
  useRejectTeamRequest,
} from "../../hooks/useOrgSettings";
import { useHasPermission } from "../../hooks/usePermissions";
import { usePaginatedList } from "../../hooks/usePaginatedList";

const TEAM_COLORS = ["#4A9FE8", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export function TeamsPage() {
  const navigate = useNavigate();
  const canManage = useHasPermission("teams:manage");
  const { data, isLoading } = useTeamsManage();
  const { data: requestsData } = useTeamRequests();
  const createTeam = useCreateTeam();
  const createRequest = useCreateTeamRequest();
  const approveRequest = useApproveTeamRequest();
  const rejectRequest = useRejectTeamRequest();
  const [showCreate, setShowCreate] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
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

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createRequest.mutateAsync({ name: name.trim(), color });
      setName("");
      setColor(TEAM_COLORS[0]);
      setShowRequest(false);
      setToast({ tone: "info", message: "팀 생성 요청을 제출했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "요청 실패" });
    }
  };

  const teams = data?.teams ?? [];
  const limits = data?.limits;
  const pendingRequests = (requestsData?.requests ?? []).filter((r) => r.status === "pending");
  const {
    visible: visibleTeams,
    page: teamsPage,
    setPage: setTeamsPage,
    totalPages: teamsTotalPages,
    totalItems: teamsTotalItems,
    pageSize: teamsPageSize,
  } = usePaginatedList(teams, teams.length);

  return (
    <div className="space-y-6">
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
          ) : (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600"
            >
              <Plus className="h-4 w-4" />
              팀 생성 요청
            </button>
          )
        }
      />

      {canManage && pendingRequests.length > 0 && (
        <GlassCard className="space-y-3 p-4">
          <p className="text-sm font-medium text-navy-800">승인 대기 ({pendingRequests.length})</p>
          {pendingRequests.map((req) => (
            <div key={req.id} className="rounded-xl bg-sky-50/60 p-3">
              <p className="font-medium text-navy-900">{req.name}</p>
              <p className="text-xs text-navy-600">{req.requesterName} · 요청</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  className="h-8 flex-1 text-xs"
                  disabled={approveRequest.isPending}
                  onClick={async () => {
                    try {
                      await approveRequest.mutateAsync(req.id);
                      setToast({ tone: "info", message: "팀 생성 요청을 승인했습니다." });
                    } catch (err) {
                      setToast({ tone: "error", message: err instanceof Error ? err.message : "승인 실패" });
                    }
                  }}
                >
                  승인
                </Button>
                <button
                  type="button"
                  className="h-8 flex-1 rounded-xl border border-red-200 text-xs text-red-500"
                  disabled={rejectRequest.isPending}
                  onClick={async () => {
                    try {
                      await rejectRequest.mutateAsync({ requestId: req.id });
                      setToast({ tone: "info", message: "요청을 거절했습니다." });
                    } catch (err) {
                      setToast({ tone: "error", message: err instanceof Error ? err.message : "거절 실패" });
                    }
                  }}
                >
                  거절
                </button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : teams.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-navy-600">소속된 팀이 없습니다.</p>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-medium text-primary-600"
            >
              첫 팀 만들기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="mt-3 text-sm font-medium text-primary-600"
            >
              팀 생성 요청하기
            </button>
          )}
        </GlassCard>
      ) : (
        <>
          <div className="space-y-2">
            {visibleTeams.map((team) => (
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
          <ListPagination
            page={teamsPage}
            totalPages={teamsTotalPages}
            totalItems={teamsTotalItems}
            pageSize={teamsPageSize}
            onPageChange={setTeamsPage}
          />
        </>
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

      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="팀 생성 요청">
        <form onSubmit={handleRequest} className="space-y-4">
          <p className="text-xs text-navy-600">관리자 승인 후 팀이 생성됩니다.</p>
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
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={createRequest.isPending} className="w-full">
            {createRequest.isPending ? "제출 중..." : "요청 제출"}
          </Button>
        </form>
      </Modal>

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
