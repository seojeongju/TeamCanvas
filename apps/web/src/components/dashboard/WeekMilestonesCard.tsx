import { Link } from "react-router-dom";
import { ChevronRight, Flag } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useDashboardInsights } from "../../hooks/useData";
function formatDueLabel(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function WeekMilestonesCard() {
  const { data: insights, isLoading } = useDashboardInsights();
  const milestones = insights?.dueSoonMilestones ?? [];

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-600">마일스톤 불러오는 중...</GlassCard>;
  }

  if (milestones.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <Flag className="mx-auto h-8 w-8 text-navy-300" />
        <p className="mt-2 text-sm text-navy-600">7일 내 마감 예정 마일스톤이 없습니다.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {milestones.map((m) => (
        <Link key={m.id} to={`/projects/${m.projectId}?tab=milestones`} className="block">
          <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-amber-50/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Flag className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-navy-900">{m.title}</p>
              <p className="mt-0.5 truncate text-xs text-navy-500">
                {m.projectName} · {formatDueLabel(m.dueAt)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
          </GlassCard>
        </Link>
      ))}
    </div>
  );
}
