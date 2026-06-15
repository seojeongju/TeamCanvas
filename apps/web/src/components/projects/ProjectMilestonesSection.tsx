import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CalendarPlus, Plus } from "lucide-react";
import { EditMilestoneModal } from "../modals/EditMilestoneModal";
import { GlassCard } from "../ui/GlassCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  useCreateProjectMilestone,
  useDeleteProjectMilestone,
  useProjectMilestones,
  useTasks,
  useSyncProjectMilestonesCalendar,
  useUpdateProjectMilestone,
} from "../../hooks/useData";
import { ProjectGanttChart } from "./ProjectGanttChart";
import { SortableMilestoneRow } from "./SortableMilestoneRow";
import { canWriteProjectContent, parseDateInputEnd } from "../../lib/projectUtils";
import { ProjectTimeline } from "./ProjectTimeline";
import type { Project, ProjectMilestone } from "../../lib/types";

type Props = {
  project: Project;
};

export function ProjectMilestonesSection({ project }: Props) {
  const { data, isLoading } = useProjectMilestones(project.id);
  const { data: tasksData } = useTasks({ projectId: project.id });
  const projectTasks = tasksData?.tasks ?? [];
  const createMilestone = useCreateProjectMilestone();
  const updateMilestone = useUpdateProjectMilestone();
  const deleteMilestone = useDeleteProjectMilestone();
  const syncCalendar = useSyncProjectMilestonesCalendar();
  const canWrite = canWriteProjectContent(project.currentUserRole);

  const milestones = useMemo(
    () =>
      [...(data?.milestones ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || (a.dueAt ?? 0) - (b.dueAt ?? 0),
      ),
    [data?.milestones],
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueAt = dueDate ? parseDateInputEnd(dueDate) : null;
    await createMilestone.mutateAsync({ projectId: project.id, title: title.trim(), dueAt });
    setTitle("");
    setDueDate("");
  };

  const toggleDone = (milestoneId: string, current: string) => {
    updateMilestone.mutate({
      milestoneId,
      projectId: project.id,
      status: current === "done" ? "pending" : "done",
    });
  };

  const handleDelete = (milestoneId: string, name: string) => {
    if (!window.confirm(`"${name}" 마일스톤을 삭제할까요?`)) return;
    deleteMilestone.mutate({ milestoneId, projectId: project.id });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = milestones.findIndex((m) => m.id === active.id);
    const newIndex = milestones.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(milestones, oldIndex, newIndex);
    reordered.forEach((m, idx) => {
      if (m.sortOrder !== idx) {
        updateMilestone.mutate({ milestoneId: m.id, projectId: project.id, sortOrder: idx });
      }
    });
  };

  const doneCount = milestones.filter((m) => m.status === "done").length;
  const calendarSyncCount = milestones.filter((m) => m.dueAt).length;

  return (
    <section className="space-y-4">
      {canWrite && calendarSyncCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => syncCalendar.mutate(project.id)}
            disabled={syncCalendar.isPending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/80 px-3 text-xs font-medium text-primary-600 ring-1 ring-sky-100/90 hover:bg-white disabled:opacity-50"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            {syncCalendar.isPending ? "동기화 중..." : `캘린더에 마일스톤 ${calendarSyncCount}건 동기화`}
          </button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-navy-800">타임라인</h2>
        <GlassCard className="mt-2 p-4">
          <ProjectTimeline project={project} milestones={milestones} />
        </GlassCard>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy-800">Gantt 차트</h2>
        <GlassCard className="mt-2 p-4">
          <ProjectGanttChart project={project} milestones={milestones} tasks={projectTasks} />
        </GlassCard>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-800">
            마일스톤
            {milestones.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-navy-500">
                {doneCount}/{milestones.length} 완료
              </span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
        ) : milestones.length === 0 ? (
          <GlassCard className="p-4 text-sm text-navy-500">등록된 마일스톤이 없습니다.</GlassCard>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={milestones.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {milestones.map((m) => (
                  <SortableMilestoneRow
                    key={m.id}
                    milestone={m}
                    canWrite={canWrite}
                    onToggleDone={toggleDone}
                    onEdit={setEditMilestone}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {canWrite && (
          <form onSubmit={handleAdd} className="mt-3 space-y-2">
            <Input
              placeholder="마일스톤 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={createMilestone.isPending || !title.trim()}>
                <Plus className="h-4 w-4" />
                추가
              </Button>
            </div>
          </form>
        )}
      </div>

      <EditMilestoneModal milestone={editMilestone} onClose={() => setEditMilestone(null)} />
    </section>
  );
}
