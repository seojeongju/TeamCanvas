import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FolderKanban, LayoutTemplate, Plus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { ListPagination } from "../components/tasks/ListPagination";
import { CreateProjectModal } from "../components/modals/CreateProjectModal";
import { ProjectBoardView } from "../components/projects/ProjectBoardView";
import { ProjectViewSwitcher } from "../components/projects/ProjectViewSwitcher";
import { ProjectListFilters } from "../components/projects/ProjectListFilters";
import { useProjects, useTeams, useUpdateProject } from "../hooks/useData";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { useHasPermission } from "../hooks/usePermissions";
import { useAuthStore } from "../stores/authStore";
import { filterProjectsList, sortProjects, type ProjectSortKey } from "../lib/projectListUtils";
import { ProjectProgressBadge } from "../components/projects/ProjectProgressBadge";
import {
  canEditProjectMeta,
  formatProjectDateRange,
  PROJECT_STATUS_OPTIONS,
  projectStatusLabel,
  projectStatusTone,
  type ProjectViewMode,
} from "../lib/projectUtils";
import { cn } from "../lib/cn";
import {
  projectWorkTone,
  workToneAccentClass,
  workToneCardClass,
  workToneTitleClass,
} from "../lib/statusVisuals";
import type { Project, ProjectStatus } from "../lib/types";

function ProjectCard({ project }: { project: Project }) {
  const workTone = projectWorkTone(project.status);
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <GlassCard
        className={cn(
          "flex overflow-hidden p-0 transition hover:bg-white/90 active:scale-[0.99]",
          workToneCardClass(workTone),
        )}
      >
        <div className={cn("w-1 shrink-0", workToneAccentClass(workTone))} aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3 p-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${project.color}22` }}
        >
          <FolderKanban className="h-5 w-5" style={{ color: project.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-semibold", workToneTitleClass(workTone))}>{project.name}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                projectStatusTone(project.status),
              )}
            >
              {projectStatusLabel(project.status)}
            </span>
            <ProjectProgressBadge percent={project.progressPercent} />
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
        </div>
      </GlassCard>
    </Link>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: teamsData } = useTeams();
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [statusReady, setStatusReady] = useState(false);
  const projectFilters = useMemo(() => {
    const f: import("../lib/types").ProjectFilters = {};
    if (teamFilter) f.teamId = teamFilter;
    if (statusFilter !== "all") f.status = statusFilter;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [teamFilter, statusFilter]);
  const { data, isLoading } = useProjects(projectFilters);
  const updateProject = useUpdateProject();
  const canWrite = useHasPermission("projects:write");
  const [viewMode, setViewMode] = useState<ProjectViewMode>("list");
  const [showCreate, setShowCreate] = useState(false);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("updated");
  const [mineOnly, setMineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const status = searchParams.get("status");
    if (
      status === "planning" ||
      status === "active" ||
      status === "on_hold" ||
      status === "done" ||
      status === "archived"
    ) {
      setStatusFilter(status);
    }
    setStatusReady(true);
  }, []);

  useEffect(() => {
    if (!statusReady) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (statusFilter === "all") next.delete("status");
        else next.set("status", statusFilter);
        return next;
      },
      { replace: true },
    );
  }, [statusFilter, statusReady, setSearchParams]);

  const teams = teamsData?.teams ?? [];
  const projects = data?.projects ?? [];
  const filtered = useMemo(() => {
    const list = filterProjectsList(projects, {
      status: statusFilter,
      mineOnly,
      userId,
      query: searchQuery,
    });
    return sortProjects(list, sortKey);
  }, [projects, statusFilter, mineOnly, userId, searchQuery, sortKey]);

  const listResetKey = `${statusFilter}-${teamFilter}-${sortKey}-${mineOnly}-${searchQuery}`;
  const {
    visible: visibleProjects,
    page: listPage,
    setPage: setListPage,
    totalPages: listTotalPages,
    totalItems: listTotalItems,
    pageSize: listPageSize,
  } = usePaginatedList(filtered, listResetKey);

  const canDragBoard = useMemo(
    () => filtered.some((p) => canEditProjectMeta(p.currentUserRole)),
    [filtered],
  );

  const handleStatusChange = (projectId: string, status: ProjectStatus) => {
    updateProject.mutate({ id: projectId, status });
  };

  return (
    <div className="space-y-3 pb-4">
      <PageHeader
        title="프로젝트"
        subtitle={projects.length > 0 ? `총 ${projects.length}개` : "팀 프로젝트를 계획하고 추적하세요"}
        action={
          canWrite ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate("/settings/project-templates")}
                className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600 hover:bg-white/90"
                aria-label="프로젝트 템플릿 설정"
              >
                <LayoutTemplate className="h-4 w-4" />
                템플릿
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600 hover:bg-white/90"
                aria-label="프로젝트 추가"
              >
                <Plus className="h-4 w-4" />
                프로젝트 추가
              </button>
            </div>
          ) : undefined
        }
      />

      {projects.length > 0 && (
        <ProjectListFilters
          teams={teams}
          teamId={teamFilter}
          sort={sortKey}
          mineOnly={mineOnly}
          query={searchQuery}
          onTeamChange={setTeamFilter}
          onSortChange={setSortKey}
          onMineToggle={() => setMineOnly((v) => !v)}
          onQueryChange={setSearchQuery}
        />
      )}

      {projects.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
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
          <ProjectViewSwitcher value={viewMode} onChange={setViewMode} />
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
      ) : viewMode === "board" && statusFilter === "all" ? (
        <ProjectBoardView
          projects={filtered}
          onStatusChange={handleStatusChange}
          canWrite={canDragBoard}
        />
      ) : (
        <>
          <div className="space-y-2">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          <ListPagination
            page={listPage}
            totalPages={listTotalPages}
            totalItems={listTotalItems}
            pageSize={listPageSize}
            onPageChange={setListPage}
          />
        </>
      )}

      {canWrite && (
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
