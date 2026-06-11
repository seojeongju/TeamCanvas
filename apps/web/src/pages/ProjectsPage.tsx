import { useMemo, useState } from "react";
import { ChevronRight, FolderKanban, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { CreateProjectModal } from "../components/modals/CreateProjectModal";
import { useProjects } from "../hooks/useData";
import { useHasPermission } from "../hooks/usePermissions";
import {
  formatProjectDateRange,
  PROJECT_STATUS_OPTIONS,
  projectStatusLabel,
  projectStatusTone,
} from "../lib/projectUtils";
import { cn } from "../lib/cn";
import type { Project, ProjectStatus } from "../lib/types";

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-white/90 active:scale-[0.99]">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${project.color}22` }}
        >
          <FolderKanban className="h-5 w-5" style={{ color: project.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-navy-900">{project.name}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                projectStatusTone(project.status),
              )}
            >
              {projectStatusLabel(project.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-navy-500">
            {project.teamName ? `${project.teamName} · ` : ""}
            {formatProjectDateRange(project.startAt, project.endAt)}
          </p>
          <p className="mt-0.5 truncate text-xs text-navy-400">
            담당 {project.ownerName}
            {project.taskCount != null && project.taskCount > 0 ? ` · 업무 ${project.taskCount}건` : ""}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
      </GlassCard>
    </Link>
  );
}

export function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const canWrite = useHasPermission("projects:write");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  const projects = data?.projects ?? [];
  const filtered = useMemo(
    () => (statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter)),
    [projects, statusFilter],
  );

  return (
    <div className="space-y-3 pb-4">
      <PageHeader
        title="프로젝트"
        subtitle={projects.length > 0 ? `총 ${projects.length}개` : "팀 프로젝트를 계획하고 추적하세요"}
      />

      {projects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              statusFilter === "all"
                ? "bg-primary-400/15 text-primary-700"
                : "bg-white/60 text-navy-600 hover:bg-white/90",
            )}
          >
            전체
          </button>
          {PROJECT_STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setStatusFilter(o.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                statusFilter === o.value
                  ? "bg-primary-400/15 text-primary-700"
                  : "bg-white/60 text-navy-600 hover:bg-white/90",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <GlassCard className="p-6 text-center text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 p-8 text-center">
          <FolderKanban className="h-10 w-10 text-navy-300" />
          <p className="text-base font-semibold text-navy-900">
            {projects.length === 0 ? "프로젝트가 없습니다" : "해당 상태의 프로젝트가 없습니다"}
          </p>
          <p className="text-sm text-navy-500">
            {projects.length === 0
              ? "새 프로젝트를 만들어 일정·업무를 묶어 관리하세요."
              : "다른 상태 필터를 선택해 보세요."}
          </p>
          {canWrite && projects.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-1 rounded-xl bg-primary-400 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            >
              프로젝트 추가
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {canWrite && filtered.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
          aria-label="프로젝트 추가"
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </button>
      )}

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
