import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderKanban } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { PROJECT_BOARD_COLUMNS, projectStatusTone, formatProjectDateRange } from "../../lib/projectUtils";
import { ProjectProgressBadge } from "./ProjectProgressBadge";
import type { Project, ProjectStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

type Props = {
  projects: Project[];
  onStatusChange: (projectId: string, status: ProjectStatus) => void;
  canWrite?: boolean;
};

function columnId(status: ProjectStatus) {
  return `column-${status}`;
}

function resolveStatus(overId: string, projects: Project[]): ProjectStatus | null {
  if (overId.startsWith("column-")) return overId.replace("column-", "") as ProjectStatus;
  const hit = projects.find((p) => p.id === overId);
  return (hit?.status as ProjectStatus) ?? null;
}

function SortableProjectCard({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: !canWrite,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...(canWrite ? { ...attributes, ...listeners } : {})}>
      <Link to={`/projects/${project.id}`} className="block" onClick={(e) => isDragging && e.preventDefault()}>
        <GlassCard className="p-3 transition hover:bg-white/90 active:scale-[0.99]">
          <div className="flex items-start gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${project.color}22` }}
            >
              <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-navy-900">{project.name}</p>
                <ProjectProgressBadge percent={project.progressPercent} />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-navy-500">
                {formatProjectDateRange(project.startAt, project.endAt)}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-navy-400">{project.ownerName}</p>
            </div>
          </div>
        </GlassCard>
      </Link>
    </div>
  );
}

function DroppableColumn({
  status,
  label,
  color,
  projects,
  canWrite,
}: {
  status: ProjectStatus;
  label: string;
  color: string;
  projects: Project[];
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

  return (
    <div className="min-w-0 flex-1">
      <div className={cn("mb-3 flex items-center gap-2 border-l-4 pl-2", color)}>
        <h3 className="text-sm font-semibold text-navy-800">{label}</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-600">
          {projects.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] space-y-2 rounded-2xl p-1 transition",
          isOver && "bg-sky-50/80 ring-2 ring-primary-400/20",
        )}
      >
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((p) => (
            <SortableProjectCard key={p.id} project={p} canWrite={canWrite} />
          ))}
        </SortableContext>
        {projects.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-navy-400">프로젝트 없음</p>
        )}
      </div>
    </div>
  );
}

export function ProjectBoardView({ projects, onStatusChange, canWrite = false }: Props) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [mobileColumn, setMobileColumn] = useState<ProjectStatus>("planning");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byColumn = useMemo(
    () =>
      PROJECT_BOARD_COLUMNS.reduce(
        (acc, col) => {
          acc[col.id] = projects.filter((p) => p.status === col.id);
          return acc;
        },
        {} as Record<ProjectStatus, Project[]>,
      ),
    [projects],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const project = projects.find((p) => p.id === event.active.id);
    setActiveProject(project ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProject(null);
    if (!canWrite) return;
    const { active, over } = event;
    if (!over) return;

    const projectId = String(active.id);
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const targetStatus = resolveStatus(String(over.id), projects);
    if (!targetStatus || project.status === targetStatus) return;
    onStatusChange(projectId, targetStatus);
  };

  if (projects.length === 0) {
    return (
      <GlassCard className="p-8 text-center text-sm text-navy-600">표시할 프로젝트가 없습니다.</GlassCard>
    );
  }

  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/50 p-1 md:hidden">
        {PROJECT_BOARD_COLUMNS.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => setMobileColumn(col.id)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition",
              mobileColumn === col.id ? "bg-primary-400/15 text-primary-700" : "text-navy-600",
            )}
          >
            {col.label} ({byColumn[col.id].length})
          </button>
        ))}
      </div>

      <div className="space-y-2 md:hidden">
        {byColumn[mobileColumn].map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="block">
            <GlassCard className="flex items-center gap-3 p-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${p.color}22` }}
              >
                <FolderKanban className="h-5 w-5" style={{ color: p.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900">{p.name}</p>
                <p className="truncate text-xs text-navy-500">{p.ownerName}</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", projectStatusTone(p.status))}>
                {PROJECT_BOARD_COLUMNS.find((c) => c.id === p.status)?.label}
              </span>
            </GlassCard>
          </Link>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden gap-3 md:flex">
          {PROJECT_BOARD_COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              status={col.id}
              label={col.label}
              color={col.color}
              projects={byColumn[col.id]}
              canWrite={canWrite}
            />
          ))}
        </div>
        <DragOverlay>
          {activeProject ? (
            <GlassCard className="rotate-2 p-3 opacity-90 shadow-lg">
              <p className="text-sm font-semibold text-navy-900">{activeProject.name}</p>
            </GlassCard>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
