import { endOfDay, fromDateLocal, startOfDay, toDateLocal } from "./dates";
import type { CalendarEvent, Task, TaskFilters, TaskPriority, TaskStatus } from "./types";

export const TASK_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "할 일", color: "border-sky-300" },
  { id: "doing", label: "진행 중", color: "border-primary-400" },
  { id: "done", label: "완료", color: "border-emerald-400" },
];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" },
];

export function getPriorityLabel(priority: string) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? "보통";
}

export function getPriorityClass(priority: string) {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-sky-100 text-navy-600";
  return "bg-amber-100 text-amber-700";
}

export function getDueClass(task: Task) {
  if (task.status === "done") return "bg-emerald-100 text-emerald-700";
  if (task.isOverdue || task.due === "지연") return "bg-red-100 text-red-700";
  if (task.due === "오늘") return "bg-orange-100 text-orange-600";
  return "bg-sky-100 text-navy-600";
}

export function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "미배정") return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function advanceStatus(status: TaskStatus): TaskStatus {
  if (status === "todo") return "doing";
  if (status === "doing") return "done";
  return "done";
}

export function regressStatus(status: TaskStatus): TaskStatus {
  if (status === "done") return "doing";
  if (status === "doing") return "todo";
  return "todo";
}

export function filterTasks(tasks: Task[], filters: TaskFilters, userId?: string) {
  const todayStart = startOfDay(Date.now());
  const todayEnd = endOfDay(Date.now());

  return tasks.filter((task) => {
    if (filters.assignee === "me" && userId && task.assigneeId !== userId) return false;
    if (filters.teamId && task.teamId !== filters.teamId) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.overdue && !task.isOverdue) return false;
    if (filters.dueToday) {
      if (task.status === "done" || !task.dueAt) return false;
      if (task.dueAt < todayStart || task.dueAt > todayEnd) return false;
    }
    if (filters.labelId && !task.labels?.some((l) => l.id === filters.labelId)) return false;
    return true;
  });
}

export function computeTaskSummary(tasks: Task[], userId?: string) {
  const todayStart = startOfDay(Date.now());
  const todayEnd = endOfDay(Date.now());

  let dueToday = 0;
  let overdue = 0;
  let mine = 0;
  let doing = 0;

  for (const task of tasks) {
    if (task.status === "doing") doing++;
    if (userId && task.assigneeId === userId) mine++;
    if (task.status === "done" || !task.dueAt) continue;
    if (task.dueAt < Date.now()) overdue++;
    else if (task.dueAt >= todayStart && task.dueAt <= todayEnd) dueToday++;
  }

  return { total: tasks.length, dueToday, overdue, mine, doing };
}

export function toDateInputValue(dueAt?: number | null) {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 마감일이 있는 미완료 프로젝트를 캘린더 all-day 이벤트로 변환 */
export function tasksToCalendarEvents(tasks: Task[], from: number, to: number): CalendarEvent[] {
  return tasks
    .filter((t) => t.dueAt && t.dueAt >= from && t.dueAt <= to && t.status !== "done")
    .map((t) => {
      const due = t.dueAt!;
      const dueDateKey = toDateLocal(due);
      const dayStart = fromDateLocal(dueDateKey);
      return {
        id: `task-${t.id}`,
        taskId: t.id,
        sourceType: "task" as const,
        title: t.title,
        startAt: dayStart,
        endAt: dayStart + 86400000,
        allDay: true,
        color: t.isOverdue ? "#EF4444" : "#F97316",
        teamName: t.teamName ?? "프로젝트 마감",
        time: t.isOverdue ? "마감 지연" : "마감",
        visibility: "private",
      };
    });
}
