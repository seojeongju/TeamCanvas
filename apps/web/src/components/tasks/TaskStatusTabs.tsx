import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { TaskStatus } from "../../lib/types";

type TaskStatusTabsProps = {
  active: TaskStatus;
  onChange: (status: TaskStatus) => void;
  counts: Record<TaskStatus, number>;
  className?: string;
};

export function TaskStatusTabs({ active, onChange, counts, className }: TaskStatusTabsProps) {
  return (
    <div
      className={cn("flex gap-1.5 rounded-2xl bg-sky-100/50 p-1", className)}
      role="tablist"
      aria-label="프로젝트 상태"
    >
      {TASK_COLUMNS.map((col) => {
        const count = counts[col.id];
        const isActive = active === col.id;
        return (
          <button
            key={col.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(col.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition",
              isActive ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:text-navy-800",
            )}
          >
            <span
              className={cn(
                "h-0.5 w-6 rounded-full",
                isActive ? col.color.replace("border-", "bg-") : "bg-transparent",
              )}
              aria-hidden
            />
            <span>{col.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums",
                isActive ? "bg-sky-100 text-navy-700" : "text-navy-500",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function taskCountsByStatus(tasks: { status: TaskStatus }[]): Record<TaskStatus, number> {
  return {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}
