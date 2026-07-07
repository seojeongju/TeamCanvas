import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { ProjectProgressBar } from "./ProjectProgressBadge";
import type { Project, ProjectMilestone, Task } from "../../lib/types";
import { cn } from "../../lib/cn";

type Props = {
  project: Project;
  tasks: Task[];
  milestones: ProjectMilestone[];
};

export function ProjectOverviewStats({ project, tasks, milestones }: Props) {
  const mainTasks = tasks.filter((t) => !t.parentTaskId);
  const subtasks = tasks.filter((t) => t.parentTaskId);
  const byStatus = {
    todo: mainTasks.filter((t) => t.status === "todo").length,
    doing: mainTasks.filter((t) => t.status === "doing").length,
    on_hold: mainTasks.filter((t) => t.status === "on_hold").length,
    done: mainTasks.filter((t) => t.status === "done").length,
  };
  const overdue = mainTasks.filter((t) => t.isOverdue && t.status !== "done").length;
  const nextMilestone = [...milestones]
    .filter((m) => m.status !== "done" && m.dueAt)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0];
  const subtaskDone = subtasks.filter((t) => t.status === "done").length;
  const subtaskRate = subtasks.length > 0 ? Math.round((subtaskDone / subtasks.length) * 100) : null;

  const cards = [
    { label: "할 일", value: byStatus.todo, tone: "text-sky-600 bg-sky-50" },
    { label: "진행 중", value: byStatus.doing, tone: "text-primary-600 bg-primary-50" },
    { label: "보류", value: byStatus.on_hold, tone: "text-amber-600 bg-amber-50" },
    { label: "완료", value: byStatus.done, tone: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <GlassCard key={c.label} className={cn("p-3 text-center", c.tone)}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-medium opacity-80">{c.label}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-navy-800">프로젝트 진행률</p>
          {project.progressPercent != null && (
            <span className="text-sm font-bold text-primary-600">{project.progressPercent}%</span>
          )}
        </div>
        {project.progressPercent != null && (
          <ProjectProgressBar percent={project.progressPercent} color={project.color} />
        )}
        <div className="grid gap-2 text-xs text-navy-600 sm:grid-cols-2">
          {subtaskRate != null && (
            <p className="flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" />
              서브태스크 완료 {subtaskDone}/{subtasks.length} ({subtaskRate}%)
            </p>
          )}
          {overdue > 0 && (
            <p className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              지연 업무 {overdue}건
            </p>
          )}
          {nextMilestone && (
            <p className="flex items-center gap-1.5 sm:col-span-2">
              <Clock className="h-3.5 w-3.5" />
              다음 마일스톤: {nextMilestone.title}
              {nextMilestone.dueAt &&
                ` (${new Date(nextMilestone.dueAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })})`}
            </p>
          )}
          {byStatus.done === mainTasks.length && mainTasks.length > 0 && (
            <p className="flex items-center gap-1.5 text-emerald-600 sm:col-span-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              모든 메인 업무가 완료되었습니다
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
