import { cn } from "../../lib/cn";
import type { WorkScopeMode } from "../../lib/workScope";
import type { TaskFilters } from "../../lib/types";

interface TaskSummaryBarProps {
  dueToday: number;
  overdue: number;
  mine: number;
  doing: number;
  filters?: TaskFilters;
  scopeMode?: WorkScopeMode;
  onFilterChange?: (filters: TaskFilters) => void;
  onScopeChange?: (mode: WorkScopeMode) => void;
}

type StatKey = "dueToday" | "overdue" | "mine" | "doing";

function preservedScope(
  filters: TaskFilters,
): Pick<TaskFilters, "teamId" | "labelId" | "projectId" | "scopeTeamIds" | "assignee"> {
  return {
    teamId: filters.teamId,
    labelId: filters.labelId,
    projectId: filters.projectId,
    scopeTeamIds: filters.scopeTeamIds,
    assignee: filters.assignee,
  };
}

function isDueTodayActive(f: TaskFilters) {
  return !!f.dueToday && !f.overdue && !f.status;
}

function isOverdueActive(f: TaskFilters) {
  return !!f.overdue && !f.dueToday && !f.status;
}

function isDoingActive(f: TaskFilters) {
  return f.status === "doing" && !f.overdue && !f.dueToday;
}

/**
 * 전체 현황 바로가기 — 조직 전체 건수 기준.
 * 「내 업무」는 상단 보기 범위(내 업무)로 전환.
 */
export function TaskSummaryBar({
  dueToday,
  overdue,
  mine,
  doing,
  filters,
  scopeMode,
  onFilterChange,
  onScopeChange,
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
      active: !!filters && isDueTodayActive(filters),
    },
    {
      key: "overdue",
      label: "지연",
      value: overdue,
      accent: overdue > 0 ? "text-red-600" : "text-navy-700",
      active: !!filters && isOverdueActive(filters),
    },
    {
      key: "mine",
      label: "내 업무",
      value: mine,
      accent: "text-primary-600",
      active: scopeMode === "mine",
    },
    {
      key: "doing",
      label: "진행 중",
      value: doing,
      accent: "text-emerald-600",
      active: !!filters && isDoingActive(filters),
    },
  ];

  const handleClick = (key: StatKey) => {
    if (!onFilterChange || !filters) return;
    const scope = preservedScope(filters);

    switch (key) {
      case "dueToday":
        onFilterChange({
          ...scope,
          dueToday: !isDueTodayActive(filters),
          overdue: false,
          status: undefined,
        });
        break;
      case "overdue":
        onFilterChange({
          ...scope,
          overdue: !isOverdueActive(filters),
          dueToday: false,
          status: undefined,
        });
        break;
      case "mine":
        onScopeChange?.(scopeMode === "mine" ? "all" : "mine");
        break;
      case "doing":
        onFilterChange({
          ...scope,
          status: isDoingActive(filters) ? undefined : "doing",
          overdue: false,
          dueToday: false,
        });
        break;
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-medium text-navy-400">전체 현황 · 탭하면 바로가기</p>
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
    </div>
  );
}
