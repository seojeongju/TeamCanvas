import { Link } from "react-router-dom";
import { AlertCircle, BarChart3, Calendar, CheckCircle2, Download, FolderKanban, Flag } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { ProjectProgressBadge } from "../projects/ProjectProgressBadge";
import type { DashboardInsights as Insights } from "../../lib/types";
import { useCurrentOrgId } from "../../stores/orgStore";
import { api } from "../../lib/api";
import { useHasPermission } from "../../hooks/usePermissions";
import { projectStatusLabel } from "../../lib/projectUtils";
import { cn } from "../../lib/cn";
import type { DashboardProjectFilter, DashboardTaskFilter } from "../../lib/dashboardStatusFilters";

const STATUS_LABELS: Record<string, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

const PROJECT_STATUS_KEYS = ["planning", "active", "on_hold", "done", "archived"] as const;

export function DashboardInsightsPanel({
  insights,
  isLoading,
  taskFilter = "all",
  projectFilter = "all",
  onTaskFilterChange,
  onProjectFilterChange,
}: {
  insights?: Insights;
  isLoading?: boolean;
  taskFilter?: DashboardTaskFilter;
  projectFilter?: DashboardProjectFilter;
  onTaskFilterChange?: (filter: DashboardTaskFilter) => void;
  onProjectFilterChange?: (filter: DashboardProjectFilter) => void;
}) {
  const orgId = useCurrentOrgId();
  const canExport = useHasPermission("org:read");

  const handleExport = async () => {
    if (!orgId) return;
    const to = Date.now();
    const from = to - 7 * 24 * 60 * 60 * 1000;
    const res = await api.downloadWeeklyReport(orgId, from, to);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teamcanvas-weekly-${new Date(from).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-navy-500">인사이트 불러오는 중…</p>
      </GlassCard>
    );
  }

  if (!insights) return null;

  const total =
    insights.tasksByStatus.todo + insights.tasksByStatus.doing + insights.tasksByStatus.done;
  const projectTotal = insights.projectsByStatus
    ? PROJECT_STATUS_KEYS.reduce((sum, k) => sum + (insights.projectsByStatus?.[k] ?? 0), 0)
    : 0;
  const weekStats = insights.weekStats;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">팀 인사이트</h2>
          <p className="text-xs text-navy-500">이번 주 업무·일정·프로젝트 요약</p>
        </div>
        {canExport && (
          <Button variant="secondary" className="!min-h-9 text-xs" onClick={handleExport}>
            <Download className="h-4 w-4" />
            주간 CSV
          </Button>
        )}
      </div>

      {weekStats && (
        <GlassCard className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">이번 주 완료</span>
          </div>
          <p className="text-xs text-navy-600">
            업무 <span className="font-semibold text-navy-800">{weekStats.tasksCompleted}</span>건
            <span className="mx-2 text-navy-300">·</span>
            마일스톤 <span className="font-semibold text-navy-800">{weekStats.milestonesCompleted}</span>건
            <span className="mx-2 text-navy-300">·</span>
            프로젝트 갱신 <span className="font-semibold text-navy-800">{weekStats.projectsUpdated}</span>건
          </p>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 gap-2">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-primary-600">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">업무 상태</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {(["todo", "doing", "done"] as const).map((key) => {
              const count = insights.tasksByStatus[key];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const isActive = taskFilter === key;
              const interactive = Boolean(onTaskFilterChange);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onTaskFilterChange?.(isActive ? "all" : key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition",
                    interactive && "hover:bg-sky-50/80",
                    isActive && "bg-primary-400/10 ring-1 ring-primary-200/80",
                    !interactive && "cursor-default",
                  )}
                >
                  <span className="text-navy-600">{STATUS_LABELS[key]}</span>
                  <span className="font-medium text-navy-800">
                    {count}건 ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-violet-600">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium">이번 주 일정</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-navy-900">{insights.weekEventCount}</p>
          <p className="text-xs text-navy-500">7일 내 일정</p>
          <Link to="/calendar" className="mt-2 inline-block text-xs text-primary-500 hover:underline">
            캘린더 보기
          </Link>
        </GlassCard>

        {insights.projectsByStatus && projectTotal > 0 && (
          <GlassCard className="col-span-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sky-600">
                <FolderKanban className="h-4 w-4" />
                <span className="text-xs font-medium">프로젝트 상태</span>
              </div>
              <Link to="/projects" className="text-xs text-primary-500 hover:underline">
                전체 보기
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {PROJECT_STATUS_KEYS.map((key) => {
                const count = insights.projectsByStatus![key] ?? 0;
                const pct = projectTotal > 0 ? Math.round((count / projectTotal) * 100) : 0;
                const isActive = projectFilter === key;
                const interactive = Boolean(onProjectFilterChange);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onProjectFilterChange?.(isActive ? "all" : key)}
                    className={cn(
                      "rounded-xl bg-white/60 px-3 py-2 text-center transition",
                      interactive && "hover:bg-white/90",
                      isActive && "bg-primary-400/10 ring-1 ring-primary-200/80",
                      !interactive && "cursor-default",
                    )}
                  >
                    <p className="text-lg font-bold text-navy-900">{count}</p>
                    <p className="text-[11px] text-navy-500">
                      {projectStatusLabel(key)} ({pct}%)
                    </p>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        )}
      </div>

      {insights.activeProjectWorkload?.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-navy-700">진행 중 프로젝트 업무량</p>
            <Link to="/projects" className="text-xs text-primary-500 hover:underline">
              프로젝트
            </Link>
          </div>
          <div className="space-y-2">
            {insights.activeProjectWorkload.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}?tab=tasks`}
                className="flex items-center gap-3 rounded-xl bg-white/60 px-3 py-2 transition hover:bg-white/90"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-800">{p.name}</p>
                  <p className="text-xs text-navy-500">
                    미완료 {p.openTaskCount}건 / 전체 {p.taskCount}건
                  </p>
                </div>
                <ProjectProgressBadge percent={p.progressPercent} />
              </Link>
            ))}
          </div>
        </GlassCard>
      )}

      {insights.dueSoonMilestones?.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-violet-600">
            <Flag className="h-4 w-4" />
            <span className="text-xs font-medium">마일스톤 마감 (7일)</span>
          </div>
          <ul className="space-y-2">
            {insights.dueSoonMilestones.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/projects/${m.projectId}?tab=milestones`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-violet-50/60 px-3 py-2 text-sm transition hover:bg-violet-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-navy-800">{m.title}</span>
                    <span className="text-navy-500"> · {m.projectName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-navy-500">
                    {new Date(m.dueAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {insights.overdueProjects?.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-red-600">
            <FolderKanban className="h-4 w-4" />
            <span className="text-xs font-medium">기한 지난 프로젝트</span>
          </div>
          <ul className="space-y-2">
            {insights.overdueProjects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-red-50/60 px-3 py-2 text-sm transition hover:bg-red-50"
                >
                  <span className="truncate font-medium text-navy-800">{p.name}</span>
                  <span className="shrink-0 text-xs text-navy-500">
                    {new Date(p.endAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {insights.dueSoonTasks.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">마감 임박 (7일)</span>
          </div>
          <ul className="space-y-2">
            {insights.dueSoonTasks.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tasks?task=${t.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-sm transition hover:bg-amber-50"
                >
                  <span className="truncate font-medium text-navy-800">{t.title}</span>
                  <span className="shrink-0 text-xs text-navy-500">
                    {new Date(t.dueAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {insights.teamWorkload.length > 0 && (
        <GlassCard className="p-4">
          <p className="mb-3 text-xs font-medium text-navy-700">팀별 업무량</p>
          <div className="space-y-2">
            {insights.teamWorkload.map((team) => (
              <div key={team.teamId} className="rounded-xl bg-white/60 px-3 py-2">
                <p className="truncate text-sm font-medium text-navy-800">{team.teamName}</p>
                <p className="mt-0.5 text-xs text-navy-500">
                  할 일 {team.todo} · 진행 {team.doing} · 완료 {team.done}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </section>
  );
}
