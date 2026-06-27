import { Link } from "react-router-dom";
import { CheckSquare, ChevronRight } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useTasks } from "../../hooks/useData";
import { useAuthStore } from "../../stores/authStore";
import {
  filterDashboardMyTasks,
  type DashboardTaskFilter,
} from "../../lib/dashboardStatusFilters";
import { taskStatusLabel, taskWorkTone, workToneBadgeClass } from "../../lib/statusVisuals";
import { cn } from "../../lib/cn";
import type { Task } from "../../lib/types";

function formatDueLabel(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const FILTER_EMPTY_LABEL: Record<DashboardTaskFilter, string> = {
  all: "진행 중인 내 업무가 없습니다.",
  todo: "할 일 상태의 내 업무가 없습니다.",
  doing: "진행 중인 내 업무가 없습니다.",
  done: "완료된 내 업무가 없습니다.",
  overdue: "지연된 내 업무가 없습니다.",
};

type Props = {
  taskFilter?: DashboardTaskFilter;
};

export function MyTasksCard({ taskFilter = "all" }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading } = useTasks();
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

  const myTasks = filterDashboardMyTasks(data?.tasks ?? [], taskFilter, userId)
    .sort((a, b) => {
      const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      if (a.status === "doing" && b.status !== "doing") return -1;
      if (b.status === "doing" && a.status !== "doing") return 1;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    })
    .slice(0, 5);

  const tasksLink =
    taskFilter === "all" || taskFilter === "overdue"
      ? taskFilter === "overdue"
        ? "/tasks?overdue=1"
        : "/tasks"
      : `/tasks?status=${taskFilter}`;

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-600">업무 불러오는 중...</GlassCard>;
  }

  if (myTasks.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <CheckSquare className="mx-auto h-8 w-8 text-navy-300" />
        <p className="mt-2 text-sm text-navy-600">{FILTER_EMPTY_LABEL[taskFilter]}</p>
        <Link
          to={tasksLink}
          className="mt-3 inline-block text-sm font-medium text-primary-500 hover:underline"
        >
          업무 보기
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {myTasks.map((task) => (
        <TaskRow key={task.id} task={task} now={now} weekEnd={weekEnd} />
      ))}
    </div>
  );
}

function TaskRow({ task, now, weekEnd }: { task: Task; now: number; weekEnd: number }) {
  const dueSoon = task.dueAt != null && task.dueAt >= now && task.dueAt <= weekEnd;
  const overdue = task.dueAt != null && task.dueAt < now && task.status !== "done";
  const tone = taskWorkTone(task);

  return (
    <Link to={`/tasks?task=${task.id}`} className="block">
      <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-sky-50/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <CheckSquare className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-medium", task.status === "done" ? "text-navy-500 line-through" : "text-navy-900")}>
              {task.title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                workToneBadgeClass(tone),
              )}
            >
              {taskStatusLabel(task.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-navy-500">
            {task.projectName ? `${task.projectName} · ` : ""}
            {task.dueAt
              ? overdue
                ? `기한 지남 · ${formatDueLabel(task.dueAt)}`
                : dueSoon
                  ? `마감 임박 · ${formatDueLabel(task.dueAt)}`
                  : `마감 ${formatDueLabel(task.dueAt)}`
              : "마감일 없음"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
      </GlassCard>
    </Link>
  );
}
