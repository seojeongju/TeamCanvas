import { Link } from "react-router-dom";
import { AlertCircle, BarChart3, Calendar, Download } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import type { DashboardInsights as Insights } from "../../lib/types";
import { useCurrentOrgId } from "../../stores/orgStore";
import { api } from "../../lib/api";
import { useHasPermission } from "../../hooks/usePermissions";

const STATUS_LABELS: Record<string, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

export function DashboardInsightsPanel({
  insights,
  isLoading,
}: {
  insights?: Insights;
  isLoading?: boolean;
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">팀 인사이트</h2>
          <p className="text-xs text-navy-500">이번 주 업무·일정 요약</p>
        </div>
        {canExport && (
          <Button variant="secondary" className="!min-h-9 text-xs" onClick={handleExport}>
            <Download className="h-4 w-4" />
            주간 CSV
          </Button>
        )}
      </div>

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
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-navy-600">{STATUS_LABELS[key]}</span>
                  <span className="font-medium text-navy-800">
                    {count}건 ({pct}%)
                  </span>
                </div>
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
      </div>

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
