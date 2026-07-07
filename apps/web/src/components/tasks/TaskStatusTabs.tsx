import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { TaskStatus } from "../../lib/types";

type TaskStatusTabsProps = {
  active: TaskStatus;
  onChange: (status: TaskStatus) => void;
  counts: Record<TaskStatus, number>;
  className?: string;
};

const STATUS_TAB_THEME: Record<
  TaskStatus,
  {
    indicator: string;
    indicatorHover: string;
    activeBg: string;
    activeText: string;
    activeBadge: string;
    inactiveText: string;
    inactiveBadge: string;
    hoverBg: string;
    hoverText: string;
    hoverBadge: string;
    hoverShadow: string;
  }
> = {
  todo: {
    indicator: "bg-sky-400",
    indicatorHover: "group-hover:bg-sky-400/70 group-hover:w-8",
    activeBg: "bg-white ring-1 ring-sky-200/80",
    activeText: "text-sky-800",
    activeBadge: "bg-sky-100 text-sky-700",
    inactiveText: "text-sky-600/85",
    inactiveBadge: "bg-sky-50/90 text-sky-600",
    hoverBg: "hover:bg-sky-50",
    hoverText: "hover:text-sky-800",
    hoverBadge: "group-hover:bg-sky-100 group-hover:text-sky-800",
    hoverShadow: "hover:shadow-sm hover:shadow-sky-200/50",
  },
  doing: {
    indicator: "bg-primary-400",
    indicatorHover: "group-hover:bg-primary-400/70 group-hover:w-8",
    activeBg: "bg-white ring-1 ring-primary-200/80",
    activeText: "text-primary-700",
    activeBadge: "bg-primary-100 text-primary-700",
    inactiveText: "text-primary-600/85",
    inactiveBadge: "bg-primary-50/90 text-primary-600",
    hoverBg: "hover:bg-primary-50",
    hoverText: "hover:text-primary-800",
    hoverBadge: "group-hover:bg-primary-100 group-hover:text-primary-800",
    hoverShadow: "hover:shadow-sm hover:shadow-primary-200/50",
  },
  done: {
    indicator: "bg-emerald-400",
    indicatorHover: "group-hover:bg-emerald-400/70 group-hover:w-8",
    activeBg: "bg-white ring-1 ring-emerald-200/80",
    activeText: "text-emerald-800",
    activeBadge: "bg-emerald-100 text-emerald-700",
    inactiveText: "text-emerald-600/85",
    inactiveBadge: "bg-emerald-50/90 text-emerald-600",
    hoverBg: "hover:bg-emerald-50",
    hoverText: "hover:text-emerald-800",
    hoverBadge: "group-hover:bg-emerald-100 group-hover:text-emerald-800",
    hoverShadow: "hover:shadow-sm hover:shadow-emerald-200/50",
  },
  on_hold: {
    indicator: "bg-amber-400",
    indicatorHover: "group-hover:bg-amber-400/70 group-hover:w-8",
    activeBg: "bg-white ring-1 ring-amber-200/80",
    activeText: "text-amber-800",
    activeBadge: "bg-amber-100 text-amber-700",
    inactiveText: "text-amber-600/85",
    inactiveBadge: "bg-amber-50/90 text-amber-600",
    hoverBg: "hover:bg-amber-50",
    hoverText: "hover:text-amber-800",
    hoverBadge: "group-hover:bg-amber-100 group-hover:text-amber-800",
    hoverShadow: "hover:shadow-sm hover:shadow-amber-200/50",
  },
};

export function TaskStatusTabs({ active, onChange, counts, className }: TaskStatusTabsProps) {
  return (
    <div
      className={cn("flex gap-1.5 rounded-2xl bg-sky-100/50 p-1", className)}
      role="tablist"
      aria-label="업무 상태"
    >
      {TASK_COLUMNS.map((col) => {
        const count = counts[col.id];
        const isActive = active === col.id;
        const theme = STATUS_TAB_THEME[col.id];
        return (
          <button
            key={col.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(col.id)}
            className={cn(
              "group flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition-all duration-200",
              isActive
                ? cn("shadow-sm", theme.activeBg, theme.activeText)
                : cn(
                    theme.inactiveText,
                    theme.hoverBg,
                    theme.hoverText,
                    theme.hoverShadow,
                    "hover:-translate-y-px",
                  ),
            )}
          >
            <span
              className={cn(
                "h-0.5 w-6 rounded-full transition-all duration-200",
                isActive ? theme.indicator : cn("bg-transparent", theme.indicatorHover),
              )}
              aria-hidden
            />
            <span className="transition-colors duration-200">{col.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums transition-colors duration-200",
                isActive
                  ? theme.activeBadge
                  : cn(theme.inactiveBadge, theme.hoverBadge),
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
    on_hold: tasks.filter((t) => t.status === "on_hold").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}
