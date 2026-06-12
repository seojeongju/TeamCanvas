import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { EditMilestoneModal } from "../modals/EditMilestoneModal";
import { GlassCard } from "../ui/GlassCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  useCreateProjectMilestone,
  useDeleteProjectMilestone,
  useProjectMilestones,
  useTasks,
  useUpdateProjectMilestone,
} from "../../hooks/useData";
import { ProjectGanttChart } from "./ProjectGanttChart";
import { canWriteProjectContent, formatMilestoneDue, MILESTONE_STATUS_OPTIONS } from "../../lib/projectUtils";
import { ProjectTimeline } from "./ProjectTimeline";
import type { Project, ProjectMilestone } from "../../lib/types";
import { cn } from "../../lib/cn";

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
  const canWrite = canWriteProjectContent(project.currentUserRole);

  const milestones = data?.milestones ?? [];
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueAt = dueDate ? new Date(`${dueDate}T23:59:59`).getTime() : null;
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

  const doneCount = milestones.filter((m) => m.status === "done").length;

  return (
    <section className="space-y-4">
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
          <div className="space-y-2">
            {milestones.map((m) => (
              <GlassCard key={m.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => toggleDone(m.id, m.status)}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition",
                    m.status === "done"
                      ? "border-emerald-200 bg-emerald-500/15 text-emerald-600"
                      : "border-sky-200 bg-white/60 text-navy-400 hover:border-primary-300",
                    !canWrite && "opacity-60",
                  )}
                  aria-label={m.status === "done" ? "완료 취소" : "완료"}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => canWrite && setEditMilestone(m)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <p
                    className={cn(
                      "font-medium text-navy-900",
                      m.status === "done" && "text-navy-500 line-through",
                    )}
                  >
                    {m.title}
                  </p>
                  <p className="text-xs text-navy-500">
                    {MILESTONE_STATUS_OPTIONS.find((o) => o.value === m.status)?.label} ·{" "}
                    {formatMilestoneDue(m.dueAt)}
                  </p>
                  {m.description?.trim() && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-navy-400">{m.description}</p>
                  )}
                </button>
                {canWrite && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditMilestone(m)}
                      className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-primary-600"
                      aria-label="수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.title)}
                      className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </GlassCard>
            ))}
          </div>
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
