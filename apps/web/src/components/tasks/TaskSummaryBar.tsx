import { cn } from "../../lib/cn";
import type { TaskFilters } from "../../lib/types";

interface TaskSummaryBarProps {
  dueToday: number;
  overdue: number;
  mine: number;
  doing: number;
  filters?: TaskFilters;
  onFilterChange?: (filters: TaskFilters) => void;
}

type StatKey = "dueToday" | "overdue" | "mine" | "doing";

export function TaskSummaryBar({
  dueToday,
  overdue,
  mine,
  doing,
  filters,
  onFilterChange,
}: TaskSummaryBarProps) {
  const items: {
    key: StatKey;
    label: string;
    value: number;
    accent: string;
    active: boolean;
  }[] = [
    {
      key: "dueToday",
      label: "오늘 마감",
      value: dueToday,
      accent: "text-orange-600",
      active: !!filters?.dueToday,
    },
    {
      key: "overdue",
      label: "지연",
      value: overdue,
      accent: overdue > 0 ? "text-red-600" : "text-navy-700",
      active: !!filters?.overdue,
    },
    {
      key: "mine",
      label: "내 업무",
      value: mine,
      accent: "text-primary-600",
      active: filters?.assignee === "me",
    },
    {
      key: "doing",
      label: "진행 중",
      value: doing,
      accent: "text-emerald-600",
      active: filters?.status === "doing",
    },
  ];

  const handleClick = (key: StatKey) => {
    if (!onFilterChange || !filters) return;
    const base = { ...filters, teamId: filters.teamId, labelId: filters.labelId };

    switch (key) {
      case "dueToday":
        onFilterChange({ ...base, dueToday: !filters.dueToday, overdue: false });
        break;
      case "overdue":
        onFilterChange({ ...base, overdue: !filters.overdue, dueToday: false });
        break;
      case "mine":
        onFilterChange({
          ...base,
          assignee: filters.assignee === "me" ? "all" : "me",
        });
        break;
      case "doing":
        onFilterChange({
          ...base,
          status: filters.status === "doing" ? undefined : "doing",
        });
        break;
    }
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((item) => {
        const interactive = Boolean(onFilterChange && filters);
        return (
          <button
            key={item.key}
            type="button"
            disabled={!interactive}
            onClick={() => handleClick(item.key)}
            className={cn(
              "flex flex-col items-center rounded-2xl border px-1 py-2.5 transition",
              item.active
                ? "border-primary-300/80 bg-primary-400/10 shadow-sm"
                : "border-sky-100/90 bg-white/70 hover:bg-white/90",
              interactive && "active:scale-[0.98]",
              !interactive && "cursor-default",
            )}
          >
            <span className={cn("text-lg font-bold leading-none tabular-nums", item.accent)}>
              {item.value}
            </span>
            <span className="mt-1 text-center text-[10px] font-medium leading-tight text-navy-500">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
