import { Link } from "react-router-dom";
import { ChevronRight, FolderKanban, Plus } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useProjects } from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { formatProjectDateRange, projectStatusLabel, projectStatusTone } from "../../lib/projectUtils";
import { cn } from "../../lib/cn";

export function ProjectsOverviewCard() {
  const { data, isLoading } = useProjects();
  const canWrite = useHasPermission("projects:write");

  const projects = (data?.projects ?? [])
    .filter((p) => p.status === "active" || p.status === "planning")
    .slice(0, 4);

  if (isLoading) {
    return (
      <GlassCard className="p-4 text-sm text-navy-600">프로젝트 불러오는 중...</GlassCard>
    );
  }

  if (projects.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <FolderKanban className="mx-auto h-8 w-8 text-navy-300" />
        <p className="mt-2 text-sm font-medium text-navy-800">진행 중인 프로젝트가 없습니다</p>
        {canWrite && (
          <Link
            to="/projects"
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-600"
          >
            <Plus className="h-4 w-4" />
            프로젝트 만들기
          </Link>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <Link key={p.id} to={`/projects/${p.id}`} className="block">
          <GlassCard className="flex items-center gap-3 p-3 transition hover:bg-white/90">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${p.color}22` }}
            >
              <FolderKanban className="h-5 w-5" style={{ color: p.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-navy-900">{p.name}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    projectStatusTone(p.status),
                  )}
                >
                  {projectStatusLabel(p.status)}
                </span>
              </div>
              <p className="truncate text-xs text-navy-500">
                {formatProjectDateRange(p.startAt, p.endAt)}
                {(p.openTaskCount ?? 0) > 0 ? ` · 업무 ${p.openTaskCount}건` : ""}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
          </GlassCard>
        </Link>
      ))}
    </div>
  );
}
